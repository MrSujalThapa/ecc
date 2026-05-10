/**
 * POST /api/elevenlabs/webhook
 *
 * Main ElevenLabs Conversational AI integration endpoint.
 *
 * Handles three kinds of ElevenLabs events:
 *
 * 1. Custom LLM webhook (real-time, per turn)
 *    ElevenLabs sends the conversation message history when it needs the next
 *    agent response. This handler:
 *      - Extracts the latest caller utterance from messages[]
 *      - Resolves the backend incident_id + call_session_id from
 *        custom_llm_extra_body or voiceSessionStore (fallback)
 *      - Calls POST /api/call/turn (via repository)
 *      - Returns the backend's say_to_caller in OpenAI chat.completions JSON
 *      - If the backend signals transfer, fires POST /api/twilio/transfer
 *
 * 2. Real-time transcript events (utterance / conversation.transcript)
 *    Stores the transcript turn and, for final turns, calls /api/call/turn.
 *
 * 3. Post-call webhook
 *    Closes the backend session via /api/call/end.
 *
 * Configure your ElevenLabs agent's "Custom LLM URL" and "Post-call webhook"
 * to point to https://your-domain.com/api/elevenlabs/webhook
 *
 * Set ELEVENLABS_WEBHOOK_SECRET to enable HMAC-SHA256 signature verification.
 */

import { NextResponse } from "next/server";
import { repositoryCallEnd, repositoryCallStart, repositoryCallTurn } from "@/lib/db/call-repository";

// ---------------------------------------------------------------------------
// Featherless voice reply — OpenAI-compatible, used when FEATHERLESS_API_KEY is set
// ---------------------------------------------------------------------------
const VOICE_SYSTEM_PROMPT = `You are a live emergency dispatch AI. A caller is on the phone right now.
Given the conversation so far, reply with ONE short sentence spoken to the caller.
Rules:
- 1-2 sentences maximum. Calm, clear, direct.
- If you don't know their location yet, ask for it.
- Fire or smoke: tell them to evacuate if safe, say help is coming.
- Break-in or intruder: tell them to stay hidden, help is coming.
- Medical emergency: tell them not to move the person, help is coming.
- Non-emergency: acknowledge and ask for their location.
- Unknown: ask one short clarifying question.
- Never repeat a question you already asked.
- Reply with ONLY the spoken sentence. No JSON, no labels, no explanation.`.trim();

const generateVoiceReplyViaFeatherless = async (
  conversationMessages: Array<{ role: "user" | "assistant"; content: string }>,
  latestText: string,
  callerLanguage?: string | null,
  triageState?: { incident_type?: string | null; location?: string | null; collected_fields?: Record<string, string> | null; missing_fields?: string[] | null } | null
): Promise<string> => {
  const key = process.env.FEATHERLESS_API_KEY?.trim();
  const model = process.env.FEATHERLESS_MODEL?.trim() ?? "google/gemma-3-4b-it";
  const base = process.env.FEATHERLESS_BASE_URL?.trim() ?? "https://api.featherless.ai/v1";
  if (!key) throw new Error("FEATHERLESS_API_KEY not set");

  // Build contextual additions to system prompt
  const additions: string[] = [];

  // Inject known incident state so Featherless never re-asks for it
  if (triageState) {
    const known: string[] = [];
    if (triageState.incident_type) known.push(`incident type: ${triageState.incident_type}`);
    if (triageState.location) known.push(`location: ${triageState.location}`);
    if (triageState.collected_fields) {
      for (const [k, v] of Object.entries(triageState.collected_fields)) {
        known.push(`${k}: ${v}`);
      }
    }
    if (known.length > 0) {
      additions.push(`Already confirmed from caller: ${known.join(", ")}. Do NOT ask for these again.`);
    }
    if (triageState.missing_fields && triageState.missing_fields.length > 0) {
      additions.push(`Still need from caller: ${triageState.missing_fields.join(", ")}.`);
    }
  }

  // Featherless always replies in English — IBM translates the response
  // into the caller's language afterward (see translateEnglishToLanguageWithIbm below).
  // Just note the language for context so the model understands the caller.
  if (callerLanguage && callerLanguage !== "en") {
    additions.push(
      `Note: the caller is speaking a non-English language (${callerLanguage}). ` +
      `Their message has been translated to English above. Reply in English — translation to their language is handled separately.`
    );
  }

  const systemPrompt = additions.length > 0
    ? `${VOICE_SYSTEM_PROMPT}\n- ${additions.join("\n- ")}`
    : VOICE_SYSTEM_PROMPT;

  // Build the full conversation turn list for Featherless (user + assistant history),
  // then append the latest caller message as the final user turn.
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...conversationMessages,
    { role: "user", content: latestText },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 80,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? `Featherless HTTP ${response.status}`);
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new Error("Featherless returned empty response");
    return text;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("Featherless voice request timed out");
    if (error instanceof Error) throw error;
    throw new Error("Featherless voice request failed");
  } finally {
    clearTimeout(timer);
  }
};
import {
  parseElevenLabsEvent,
  verifyElevenLabsSignature,
} from "@/lib/voice/elevenlabsWebhookParser";
import { buildElevenLabsLlmResponse } from "@/lib/voice/callRouting";
import {
  elevenLabsConfig,
  SAFE_FALLBACK_PHRASE,
  VOICE_SOURCE_LABEL,
} from "@/lib/voice/voiceConfig";
import {
  getSessionByElevenLabsId,
  getSessionByTwilioSid,
  registerVoiceSession,
  updateVoiceSessionElevenLabsId,
  patchVoiceSessionIds,
  patchVoiceTriageState,
} from "@/lib/voice/voiceSessionStore";
import { enrichTranscriptWithIbmTranslation } from "@/lib/voice/transcriptTranslation";
import { translateEnglishToLanguageWithIbm } from "@/lib/voice/ibmLanguageTranslator";

// ---------------------------------------------------------------------------
// Helper: build LLM response — streaming SSE or plain JSON
// ElevenLabs sends stream:true with stream_options, so we must support SSE.
// ---------------------------------------------------------------------------

const buildLlmResponse = (text: string, stream: boolean): Response => {
  if (!stream) {
    return NextResponse.json(buildElevenLabsLlmResponse(text));
  }
  const id = `chatcmpl-${Date.now()}`;
  const lines: string[] = [
    // First chunk: role
    `data: ${JSON.stringify({ id, object: "chat.completion.chunk", choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] })}\n\n`,
    // Content chunk
    `data: ${JSON.stringify({ id, object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: text }, finish_reason: null }] })}\n\n`,
    // Stop chunk
    `data: ${JSON.stringify({ id, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`,
    "data: [DONE]\n\n",
  ];
  const body = lines.join("");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};

// ---------------------------------------------------------------------------
// Helper: trigger transfer via internal route
// ---------------------------------------------------------------------------

const triggerTransfer = async (opts: {
  twilio_call_sid: string;
  incident_id: string;
  call_session_id: string;
  baseUrl: string;
}): Promise<void> => {
  try {
    await fetch(`${opts.baseUrl}/api/twilio/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        twilio_call_sid: opts.twilio_call_sid,
        incident_id: opts.incident_id,
        call_session_id: opts.call_session_id,
      }),
    });
  } catch (e) {
    console.error("[elevenlabs/webhook] Transfer trigger error:", e);
  }
};

// ---------------------------------------------------------------------------
// Helper: derive base URL from request (for internal fetch)
// ---------------------------------------------------------------------------

const getBaseUrl = (request: Request): string => {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
};

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export const POST = async (request: Request): Promise<NextResponse | Response> => {
  // Read raw body for signature verification
  const rawBody = await request.text();

  // Verify ElevenLabs webhook signature (if secret is configured)
  const signature =
    request.headers.get("elevenlabs-signature") ??
    request.headers.get("x-elevenlabs-signature") ??
    null;

  const signatureValid = await verifyElevenLabsSignature(
    signature,
    rawBody,
    elevenLabsConfig.webhookSecret
  );

  if (!signatureValid) {
    console.warn("[elevenlabs/webhook] Invalid signature — rejecting request.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse body
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const event = parseElevenLabsEvent(parsedBody);

  // Log top-level keys of every incoming event to help debug session resolution
  if (typeof parsedBody === "object" && parsedBody !== null) {
    const topKeys = Object.keys(parsedBody as Record<string, unknown>);
    console.info(`[elevenlabs/webhook] event.kind=${event.kind} top-level keys: ${topKeys.join(", ")}`);
    // Log conversation_id from top level if present
    const rawConvId = (parsedBody as Record<string, unknown>).conversation_id;
    if (rawConvId) console.info(`[elevenlabs/webhook] top-level conversation_id=${rawConvId}`);
  }

  // -------------------------------------------------------------------------
  // 1. Custom LLM webhook — real-time per-turn response
  // -------------------------------------------------------------------------
  if (event.kind === "llm_turn") {
    const { latestUserText, incidentId, callSessionId, conversationId, twilioCallSid } = event;
    const wantsStream = (parsedBody as Record<string, unknown>).stream === true;
    console.info(`[elevenlabs/webhook] stream=${wantsStream}`);




    // Resolve incident/session IDs (from extra body, or store lookup)
    let resolvedIncidentId = incidentId;
    let resolvedCallSessionId = callSessionId;
    let resolvedTwilioCallSid = twilioCallSid;

    // Fallback: look up by conversation_id
    if ((!resolvedIncidentId || !resolvedCallSessionId) && conversationId) {
      const entry = getSessionByElevenLabsId(conversationId);
      if (entry) {
        resolvedIncidentId = resolvedIncidentId ?? entry.incident_id;
        resolvedCallSessionId = resolvedCallSessionId ?? entry.call_session_id;
      }
    }

    // Fallback: look up by twilio call SID
    if ((!resolvedIncidentId || !resolvedCallSessionId) && twilioCallSid) {
      const entry = getSessionByTwilioSid(twilioCallSid);
      if (entry) {
        resolvedIncidentId = resolvedIncidentId ?? entry.incident_id;
        resolvedCallSessionId = resolvedCallSessionId ?? entry.call_session_id;
      }
    }

    console.info(
      `[elevenlabs/webhook] turn IDs from payload → incidentId=${incidentId ?? "null"} sessionId=${callSessionId ?? "null"} convId=${conversationId ?? "null"} sid=${twilioCallSid ?? "null"}`
    );

    // isNewCall = true when this is a brand-new call and we generated temp local UUIDs.
    let isNewCall = false;
    // Resolves with real Supabase IDs once repositoryCallStart completes.
    // The turn 1 save awaits this so it never races against the DB write.
    let resolveRealIds: (val: { incident_id: string; call_session_id: string } | null) => void = () => {};
    const realIdsReady = new Promise<{ incident_id: string; call_session_id: string } | null>(
      (resolve) => { resolveRealIds = resolve; }
    );

    if (!resolvedIncidentId || !resolvedCallSessionId) {
      // ElevenLabs Phone Numbers integration does NOT send a conversation_id in the
      // Custom LLM webhook payload. We use a message-fingerprint to track the session
      // across multiple turns: the first user utterance is stable for the whole call.
      const firstUserMsg = event.messages.find((m) => m.role === "user")?.content ?? "";
      const fingerprint = `fp:${firstUserMsg.slice(0, 120)}`;

      // Check if we already created an incident for this call (later turns)
      const fpEntry = getSessionByElevenLabsId(fingerprint);
      if (fpEntry) {
        resolvedIncidentId = fpEntry.incident_id;
        resolvedCallSessionId = fpEntry.call_session_id;
        console.info(
          `[elevenlabs/webhook] Resolved session via fingerprint: incident=${resolvedIncidentId}`
        );
      } else {
        // First turn of a new call — generate IDs locally (instant, no DB wait).
        // Register in memory immediately so subsequent turns can find the session.
        // Supabase write happens async so it never blocks the voice response.
        isNewCall = true;
        resolvedIncidentId = crypto.randomUUID();
        resolvedCallSessionId = crypto.randomUUID();

        registerVoiceSession({
          twilio_call_sid: fingerprint,
          incident_id: resolvedIncidentId,
          call_session_id: resolvedCallSessionId,
          mode: "normal",
        });
        updateVoiceSessionElevenLabsId(fingerprint, fingerprint);
        if (conversationId && conversationId !== fingerprint) {
          registerVoiceSession({
            twilio_call_sid: conversationId,
            incident_id: resolvedIncidentId,
            call_session_id: resolvedCallSessionId,
            mode: "normal",
          });
          updateVoiceSessionElevenLabsId(conversationId, conversationId);
        }

        console.info(
          `[elevenlabs/webhook] New call — incident=${resolvedIncidentId} (async DB write)`
        );

        // Persist to Supabase async — when it resolves, patch session store with
        // real Supabase IDs so turn 2+ repositoryCallTurn writes succeed (M1/M4 integration).
        const autoConvKey = conversationId ?? fingerprint;
        const localIncidentId = resolvedIncidentId;
        void repositoryCallStart({
          mode: "normal",
          twilio_call_sid: null,
          elevenlabs_conversation_id: autoConvKey,
        }).then((started) => {
          // Replace temp local UUIDs with real Supabase IDs across all session keys
          patchVoiceSessionIds(fingerprint, started.incident_id, started.call_session_id);
          if (conversationId && conversationId !== fingerprint) {
            patchVoiceSessionIds(conversationId, started.incident_id, started.call_session_id);
          }
          console.info(
            `[elevenlabs/webhook] ✅ Session patched: local=${localIncidentId} → real=${started.incident_id} (Supabase: ${started.incident_id !== localIncidentId ? "YES" : "in-memory"})`
          );
          // Signal that real IDs are ready. The turn 1 save (below) is waiting on this.
          resolveRealIds({ incident_id: started.incident_id, call_session_id: started.call_session_id });
        }).catch((e) => {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.error(
            `[elevenlabs/webhook] ❌ repositoryCallStart FAILED — all turns will NOT_FOUND. Error: ${errMsg}`
          );
          console.error("[elevenlabs/webhook] → If error mentions 'relation does not exist', run your Supabase migration SQL.");
          console.error("[elevenlabs/webhook] → If error mentions 'JWT expired' or 'Invalid API key', check SUPABASE_SERVICE_ROLE_KEY in .env.local.");
          resolveRealIds(null);
        });
      }
    }

    // Read cached triage state from the previous turn (populated async after
    // repositoryCallTurn resolves). This tells Featherless what has already
    // been gathered so it never asks for the same thing twice.
    const sessionKey = conversationId ?? twilioCallSid ?? resolvedIncidentId;
    const cachedTriageState = sessionKey
      ? (getSessionByElevenLabsId(sessionKey) ?? getSessionByTwilioSid(sessionKey ?? ""))?.triage_state
      : undefined;

    // Build context from message history — only count non-empty user turns.
    // ElevenLabs sends empty user messages on silence/inactivity timeouts; counting
    // those as real turns causes the branching logic to skip ahead and repeat phrases.
    const allUserMessages = event.messages
      .filter((m) => m.role === "user")
      .map((m) => (m.content ?? "").toLowerCase());

    const substantiveUserMsgs = allUserMessages.filter((t) => t.trim().length > 0);
    const turnNumber = substantiveUserMsgs.length; // 1 = first real caller utterance
    const fullContext = substantiveUserMsgs.join(" ");

    console.info(
      `[elevenlabs/webhook] llm_turn: total_msgs=${event.messages.length} user_msgs=${allUserMessages.length} substantive=${turnNumber} latestUserText.len=${latestUserText.trim().length}`
    );

    if (!latestUserText.trim()) {
      if (turnNumber === 0) {
        // True opening — no caller has spoken yet.
        console.info("[elevenlabs/webhook] No user message — returning opening greeting.");
        return buildLlmResponse("Emergency dispatch. What is your emergency?", wantsStream);
      }
      // Silence/inactivity turn mid-call — don't restart with the opening greeting.
      // Just hold the line without repeating questions.
      console.info(`[elevenlabs/webhook] Empty turn mid-call (substantive=${turnNumber}) — holding line.`);
      return buildLlmResponse("I'm here. Please take your time.", wantsStream);
    }

    // ---------------------------------------------------------------------------
    // Voice AI: call Featherless with an 8-second hard timeout.
    // Featherless is OpenAI-compatible and typically faster than Google AI Studio.
    // If Featherless doesn't respond in time, the context-aware fallback below
    // fires instantly using the full conversation context.
    // ---------------------------------------------------------------------------

    // IBM Multilingual Incident Layer — translate final caller text to English before AI reasoning
    // Log the raw transcript so we can see exactly what ElevenLabs STT produced
    console.info(
      `[elevenlabs/webhook] raw transcript (${latestUserText.length} chars): "${latestUserText.slice(0, 120)}"`
    );
    const translated = await enrichTranscriptWithIbmTranslation({
      text: latestUserText,
      isFinal: true,
    });
    const reasoningText = translated.translated_text ?? latestUserText;
    console.info(
      `[elevenlabs/webhook] IBM result: lang=${translated.language ?? "null"} provider=${translated.translation_provider} translated="${(translated.translated_text ?? "").slice(0, 80)}"`
    );

    /** Context-aware fallback used when Gemma times out or errors.
     *  Always matches against the English-translated context but uses
     *  hardcoded bilingual phrases for common languages so the caller
     *  still hears their language if Featherless fails.
     */
    const voiceFallback = (ctx: string, turn: number, lang: string | null): string => {
      const c = ctx.toLowerCase();
      const hasFire     = /fire|smoke|gas leak|gas|flood|fuego|incendio|feu|feuer/.test(c);
      const hasIntruder = /break.?in|intruder|shooting|stabbing|burglar|intruso|ladr/.test(c);
      const hasMedical  = /medical|collapse|unconscious|trapped|accident|injur|hurt|chest pain|not breathing|médico|médica|blessé/.test(c);
      const hasEmergency = hasFire || hasIntruder || hasMedical || /emergency|emergencia|urgence/.test(c);

      // Bilingual hardcoded phrases for the most common caller languages
      type Phrases = { location: string; help: string; fire: string; intruder: string; medical: string };
      const PHRASES: Record<string, Phrases> = {
        es: {
          location: "¿Puede describirme qué pasó y dónde está? (Can you describe what happened and where you are?)",
          help:     "Los servicios de emergencia han sido notificados. Quédese en línea. (Emergency services notified. Stay on the line.)",
          fire:     "Evacúe si es seguro hacerlo. La ayuda está en camino. (Evacuate if safe. Help is on the way.)",
          intruder: "Escóndase y no confronte a nadie. La ayuda llega. (Hide and do not confront anyone. Help is coming.)",
          medical:  "No mueva a la persona. La ayuda está en camino. (Do not move the person. Help is on the way.)",
        },
        fr: {
          location: "Pouvez-vous décrire ce qui s'est passé et où vous êtes ? (Can you describe what happened and where you are?)",
          help:     "Les secours ont été alertés. Restez en ligne. (Emergency services notified. Stay on the line.)",
          fire:     "Évacuez si c'est sans danger. Les secours arrivent. (Evacuate if safe. Help is on the way.)",
          intruder: "Cachez-vous et n'affrontez personne. Les secours arrivent. (Hide and do not confront anyone. Help is coming.)",
          medical:  "Ne bougez pas la personne. Les secours arrivent. (Do not move the person. Help is on the way.)",
        },
        pt: {
          location: "Pode descrever o que aconteceu e onde você está? (Can you describe what happened and where you are?)",
          help:     "Os serviços de emergência foram notificados. Fique na linha. (Emergency services notified. Stay on the line.)",
          fire:     "Evacue se for seguro. A ajuda está a caminho. (Evacuate if safe. Help is on the way.)",
          intruder: "Esconda-se e não confronte ninguém. A ajuda está a caminho. (Hide. Help is coming.)",
          medical:  "Não mova a pessoa. A ajuda está a caminho. (Do not move the person. Help is on the way.)",
        },
      };
      const p = lang ? PHRASES[lang] : null;

      if (!hasEmergency) {
        return p?.location ?? (turn === 1
          ? "Can you describe what happened and where you are?"
          : "Got it. Can you give me your exact location?");
      }
      if (turn === 1) return p?.location ?? "What is your exact location?";
      if (hasFire)     return p?.fire     ?? "Evacuate immediately if it is safe to do so. Emergency services have been notified and are on their way.";
      if (hasIntruder) return p?.intruder ?? "Find a safe place and stay hidden. Do not confront anyone. Help is on the way.";
      if (hasMedical)  return p?.medical  ?? "Stay calm and do not move the person. Keep them still. Help is on the way.";
      return p?.help ?? "Emergency services have been notified. Stay on the line.";
    };

    let sayToCaller: string;
    let shouldTransfer = false;
    let shouldEnd = false;

    try {
      // Build the full conversation history (user + assistant) from the ElevenLabs message list.
      // Exclude the very last message (the current caller turn — passed separately as latestText).
      // This gives Featherless full context of what the agent already said so it never repeats.
      const conversationMessages = event.messages
        .filter((m) => (m.role === "user" || m.role === "assistant") && (m.content ?? "").trim())
        .slice(0, -1)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content ?? "" }));

      console.info(
        `[elevenlabs/webhook] Featherless context: ${conversationMessages.length} prior turns, lang=${translated.language ?? "en"}`
      );

      // Direct Featherless call with full conversation context and cached incident state.
      sayToCaller = await Promise.race([
        generateVoiceReplyViaFeatherless(conversationMessages, reasoningText, translated.language, cachedTriageState),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("voice_timeout")), 8000)
        ),
      ]);

      console.info(`[elevenlabs/webhook] Featherless voice reply (${sayToCaller.length} chars)`);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "unknown";
      console.warn(`[elevenlabs/webhook] Featherless ${reason === "voice_timeout" ? "timed out (>8s)" : "error: " + reason} -- using context fallback`);
      sayToCaller = voiceFallback(fullContext, turnNumber, translated.language ?? null);
    }

    // ---------------------------------------------------------------------------
    // IBM response translation — if caller is non-English, translate the English
    // reply back into their language. IBM already ran (caller → English) so the
    // IAM token is cached; this second call is fast (~300-600ms).
    // On any failure, fall back to the English response so the call never blocks.
    // ---------------------------------------------------------------------------
    if (
      translated.language &&
      translated.language !== "en" &&
      process.env.IBM_TRANSLATION_ENABLED === "true"
    ) {
      try {
        const localised = await translateEnglishToLanguageWithIbm(sayToCaller, translated.language);
        if (localised) {
          // Bilingual: caller hears their language, dispatcher reads English in parens
          sayToCaller = `${localised} (${sayToCaller})`;
          console.info(`[elevenlabs/webhook] IBM response translated to ${translated.language}: ${sayToCaller.length} chars`);
        }
      } catch {
        // Non-blocking — English fallback stays
        console.warn(`[elevenlabs/webhook] IBM response translation failed — using English`);
      }
    }

    // Persist transcript + incident update async -- cache triage state for next turn.
    const turnSessionKey = conversationId ?? twilioCallSid ?? resolvedIncidentId;
    if (isNewCall) {
      // Turn 1: capture transcript data now (closure), then wait for real Supabase
      // IDs via realIdsReady. This handles both orderings:
      //   - repositoryCallStart resolves before Featherless → waits for this code
      //   - Featherless resolves before repositoryCallStart → waits for real IDs
      const t1Text = latestUserText;
      const t1Language = translated.language;
      const t1TranslatedText = translated.translated_text;
      const t1TriageKey = conversationId ?? twilioCallSid ?? resolvedIncidentId;
      void realIdsReady.then(async (realIds) => {
        if (!realIds) return;
        try {
          const result = await repositoryCallTurn({
            incident_id: realIds.incident_id,
            call_session_id: realIds.call_session_id,
            speaker: "caller",
            text: t1Text,
            is_final: true,
            source: VOICE_SOURCE_LABEL,
            language: t1Language,
            translated_text: t1TranslatedText,
          });
          const inc = result.incident;
          patchVoiceTriageState(t1TriageKey, {
            incident_type: inc.incident_type ?? null,
            location: inc.location ?? null,
            collected_fields: (inc.collected_fields as Record<string, string> | null) ?? null,
            missing_fields: inc.missing_fields ?? null,
          });
          console.info(
            `[elevenlabs/webhook] Turn 1 saved: type=${inc.incident_type ?? "?"} location=${inc.location ?? "?"}`
          );
        } catch (e) {
          console.error("[elevenlabs/webhook] Turn 1 save error:", e);
        }
      });
    } else {
      console.info(
        `[elevenlabs/webhook] Turn 2+: saving with incident=${resolvedIncidentId} session=${resolvedCallSessionId}`
      );
      void repositoryCallTurn({
        incident_id: resolvedIncidentId,
        call_session_id: resolvedCallSessionId,
        speaker: "caller",
        text: latestUserText,
        is_final: true,
        source: VOICE_SOURCE_LABEL,
        language: translated.language,
        translated_text: translated.translated_text,
      }).then((result) => {
        const inc = result.incident;
        if (turnSessionKey) {
          patchVoiceTriageState(turnSessionKey, {
            incident_type: inc.incident_type ?? null,
            location: inc.location ?? null,
            collected_fields: (inc.collected_fields as Record<string, string> | null) ?? null,
            missing_fields: inc.missing_fields ?? null,
          });
          console.info(
            `[elevenlabs/webhook] Triage state cached: type=${inc.incident_type ?? "?"} location=${inc.location ?? "?"} missing=${(inc.missing_fields ?? []).join(",") || "none"}`
          );
        }
      }).catch((e) =>
        console.error("[elevenlabs/webhook] async call/turn error:", e)
      );
    }

    // Decide next voice action
    const action = shouldTransfer
      ? { type: "transfer" as const, reason: "operator_required" }
      : shouldEnd
      ? { type: "end" as const, reason: "completed" }
      : { type: "say" as const, text: sayToCaller };

    if (action.type === "transfer") {
      if (resolvedTwilioCallSid) {
        void triggerTransfer({
          twilio_call_sid: resolvedTwilioCallSid,
          incident_id: resolvedIncidentId,
          call_session_id: resolvedCallSessionId,
          baseUrl: getBaseUrl(request),
        });
      } else {
        console.warn("[elevenlabs/webhook] Transfer needed but no twilio_call_sid available.");
      }
      const bridgeText =
        sayToCaller !== SAFE_FALLBACK_PHRASE
          ? sayToCaller
          : "I am connecting you to an operator now. Please stay on the line.";
      return buildLlmResponse(bridgeText, wantsStream);
    }

    if (action.type === "end") {
      return buildLlmResponse(
        sayToCaller !== SAFE_FALLBACK_PHRASE
          ? sayToCaller
          : "Your report has been received. Thank you for calling.",
        wantsStream
      );
    }

    return buildLlmResponse(action.text, wantsStream);
  }

  // ---------------------------------------------------------------------------
  // 2. Real-time transcript event
  // ---------------------------------------------------------------------------
  if (event.kind === "transcript") {
    const { conversationId, text, isFinal, role } = event;

    if (!isFinal || role !== "user" || !text.trim()) {
      return NextResponse.json({ ok: true, note: "partial or agent turn -- skipped" });
    }

    const entry = getSessionByElevenLabsId(conversationId);
    if (!entry) {
      console.warn(`[elevenlabs/webhook] Transcript event: no session for conv_id=${conversationId}`);
      return NextResponse.json({ ok: true, note: "session not found" });
    }

    try {
      await repositoryCallTurn({
        incident_id: entry.incident_id,
        call_session_id: entry.call_session_id,
        speaker: "caller",
        text,
        is_final: true,
        source: VOICE_SOURCE_LABEL,
      });
    } catch (e) {
      console.error("[elevenlabs/webhook] transcript call/turn error:", e);
    }

    return NextResponse.json({ ok: true });
  }

  // ---------------------------------------------------------------------------
  // 3. Post-call webhook -- conversation ended
  // ---------------------------------------------------------------------------
  if (event.kind === "post_call") {
    const { conversationId } = event;
    const entry = getSessionByElevenLabsId(conversationId);

    if (!entry) {
      console.warn(`[elevenlabs/webhook] Post-call: no session for conv_id=${conversationId}`);
      return NextResponse.json({ ok: true, note: "session not found" });
    }

    try {
      await repositoryCallEnd({
        incident_id: entry.incident_id,
        call_session_id: entry.call_session_id,
        reason: "completed",
      });
      console.info(`[elevenlabs/webhook] Post-call: closed session incident=${entry.incident_id}`);
    } catch (e) {
      console.error("[elevenlabs/webhook] post-call call/end error:", e);
    }

    return NextResponse.json({ ok: true });
  }

  // Unknown event type -- log and return 200 so ElevenLabs does not retry
  return NextResponse.json({ ok: true, note: "unknown event" });
};
