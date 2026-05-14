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
import { runEmergencyTurn } from "@/lib/runtime/runEmergencyTurn";
import { resolveCallerPhoneJsonOrTwilio } from "@/lib/voice/callerPhoneResolution";
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
  getRecentPhoneSession,
  registerVoiceSession,
  updateVoiceSessionElevenLabsId,
  patchVoiceSessionIds,
  patchVoiceTriageState,
} from "@/lib/voice/voiceSessionStore";
import type {
  VoiceTranscriptHistoryTurn,
  VoiceTriageState,
} from "@/lib/voice/voiceSessionStore";
import { enrichTranscriptWithIbmTranslation } from "@/lib/voice/transcriptTranslation";
import { translateEnglishToLanguageWithIbm } from "@/lib/voice/ibmLanguageTranslator";

// ---------------------------------------------------------------------------
// Featherless voice reply — OpenAI-compatible, used when FEATHERLESS_API_KEY is set
// ---------------------------------------------------------------------------
const VOICE_SYSTEM_PROMPT = `You are a live emergency dispatch AI. A caller is on the phone right now.
Given the conversation so far, reply with ONE short sentence spoken to the caller.
Rules:
- 1-2 sentences maximum. Calm, clear, direct.
- If you don't know their exact location yet, ask for it.
- Fire or smoke: tell them to evacuate if safe, say emergency services have been notified.
- Break-in or active intruder: tell them to stay hidden and not confront anyone.
- Medical emergency (unconscious, not breathing, severe injury): tell them not to move the person.
- Theft, vandalism, noise complaint, or other non-emergency: acknowledge calmly and ask for their exact location. Do NOT say help is on the way.
- Unknown situation: ask one short clarifying question.
- NEVER promise that police, security, fire, ambulance, or any service is "on the way" or "has been contacted" — you do not know this and must not say it.
- Never repeat a question you already asked.
- Reply with ONLY the spoken sentence. No JSON, no labels, no explanation.`.trim();

const generateVoiceReplyViaFeatherless = async (
  conversationMessages: Array<{ role: "user" | "assistant"; content: string }>,
  latestText: string,
  callerLanguage?: string | null,
  triageState?: VoiceTriageState | null
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
    if (triageState.urgency) known.push(`urgency: ${triageState.urgency}`);
    if (triageState.location) known.push(`location: ${triageState.location}`);
    if (triageState.location_status) known.push(`location status: ${triageState.location_status}`);
    if (triageState.summary) known.push(`summary: ${triageState.summary}`);
    // Intentionally excluded: operator_required, should_escalate, status, call_status, control_state
    // — these are backend routing signals and cause Featherless to incorrectly say hold/transfer phrases.
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
    if (triageState.last_question) {
      additions.push(`Last AI question asked: ${triageState.last_question}. Do not repeat it unless the caller asks you to.`);
    }
    if (triageState.next_question) {
      additions.push(`Continue with this next intake question if still relevant: ${triageState.next_question}.`);
    }
    const recentHistory = triageState.recent_transcript_history ?? triageState.transcriptHistory ?? [];
    if (recentHistory.length > 0) {
      const recentLines = recentHistory
        .slice(-6)
        .map((turn) => `${turn.role}: ${turn.text}`)
        .join(" | ");
      additions.push(`Recent final voice turns: ${recentLines}.`);
    }
  }

  // Never let Featherless say hold/connecting phrases — those are only emitted
  // explicitly by the shouldTransfer branch which never calls Featherless.
  additions.push(
    "CRITICAL: Do NOT say 'please hold', 'stay on the line while I connect', 'I am connecting you', " +
    "'please remain on the line', 'I will connect you', or any similar transfer-hold phrases. " +
    "You are gathering information. Ask the next relevant question."
  );

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

const voiceDebugEnabled = (): boolean => process.env.ECC_VOICE_DEBUG === "true";

const shortText = (value: unknown, maxLength = 140): string | null => {
  if (typeof value !== "string") return null;
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength
    ? `${compact.slice(0, maxLength)}...`
    : compact;
};

const redactPhone = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return "[redacted-phone]";
  return `[redacted-phone:*${digits.slice(-4)}]`;
};

const summarizeKeys = (value: unknown): string[] =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>).sort()
    : [];

const recentHistoryFor = (
  state: VoiceTriageState | null | undefined
): VoiceTranscriptHistoryTurn[] => state?.recent_transcript_history ?? state?.transcriptHistory ?? [];

const looksLikeQuestion = (value: string | null | undefined): boolean => {
  const compact = shortText(value, 500);
  if (!compact) return false;
  return (
    /\?\s*$/.test(compact) ||
    /^(can|could|what|where|when|who|why|how|do|did|does|is|are|was|were|tell me|please tell me)\b/i.test(compact)
  );
};

const lastQuestionFrom = (
  sayToCaller: string | null | undefined,
  nextQuestion?: string | null
): string | null => {
  if (nextQuestion && looksLikeQuestion(nextQuestion)) return nextQuestion;
  if (sayToCaller && looksLikeQuestion(sayToCaller)) return sayToCaller;
  return null;
};

const voiceStateDebugFields = (
  state: VoiceTriageState | null | undefined,
  transcriptHistoryLength: number | null
): Record<string, unknown> => ({
  transcriptHistoryLength,
  incident_type_before: state?.incident_type ?? null,
  urgency_before: state?.urgency ?? null,
  summary_before: shortText(state?.summary),
  status_before: state?.status ?? null,
  call_status_before: state?.call_status ?? null,
  control_state_before: state?.control_state ?? null,
  ai_active_before: state?.ai_active ?? null,
  operator_required_before: state?.operator_required ?? null,
  should_escalate_before: state?.should_escalate ?? null,
  location_status_before: state?.location_status ?? null,
  location_before: shortText(state?.location, 100),
  collected_fields_keys_before: summarizeKeys(state?.collected_fields),
  missing_fields_before: state?.missing_fields ?? null,
  previous_next_question: shortText(state?.next_question),
  last_question: shortText(state?.last_question),
  last_say_to_caller: shortText(state?.last_say_to_caller),
});

const voiceDebug = (
  stage: "before-ai" | "after-ai" | "after-merge",
  payload: Record<string, unknown>
): void => {
  if (!voiceDebugEnabled()) return;
  console.info(`[ECC Voice Debug] ${stage}`, payload);
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

  console.info(
    `[elevenlabs/webhook] POST content-type=${request.headers.get("content-type") ?? "(none)"}`
  );

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
    console.info(
      `[elevenlabs/webhook] llm_turn ids incidentId=${incidentId ?? "null"} callSessionId=${callSessionId ?? "null"} ` +
        `conversationId=${conversationId ?? "null"} twilioCallSid=${twilioCallSid ?? "null"}`
    );




    // Resolve incident/session IDs (from extra body, or store lookup)
    let resolvedIncidentId = incidentId;
    let resolvedCallSessionId = callSessionId;
    let resolvedTwilioCallSid = twilioCallSid;
    let sessionLookupKey: string | undefined = conversationId ?? twilioCallSid ?? undefined;

    // Fallback: look up by conversation_id
    if ((!resolvedIncidentId || !resolvedCallSessionId) && conversationId) {
      const entry = getSessionByElevenLabsId(conversationId);
      if (entry) {
        resolvedIncidentId = resolvedIncidentId ?? entry.incident_id;
        resolvedCallSessionId = resolvedCallSessionId ?? entry.call_session_id;
        sessionLookupKey = conversationId;
      }
    }

    // Fallback: look up by twilio call SID
    if ((!resolvedIncidentId || !resolvedCallSessionId) && twilioCallSid) {
      const entry = getSessionByTwilioSid(twilioCallSid);
      if (entry) {
        resolvedIncidentId = resolvedIncidentId ?? entry.incident_id;
        resolvedCallSessionId = resolvedCallSessionId ?? entry.call_session_id;
        sessionLookupKey = twilioCallSid;
      }
    }

    console.info(
      `[elevenlabs/webhook] turn IDs from payload → incidentId=${incidentId ?? "null"} sessionId=${callSessionId ?? "null"} convId=${conversationId ?? "null"} sid=${twilioCallSid ?? "null"}`
    );

    // isNewCall = true when this is a brand-new call and we generated temp local UUIDs.
    let isNewCall = false;
    // Resolves with real Supabase IDs once repositoryCallStart completes.
    // The turn 1 save awaits this so it never races against the DB write.
    let resolveRealIds: (val: { incident_id: string; call_session_id: string } | null) => void = () => { };
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
        sessionLookupKey = fingerprint;
        console.info(
          `[elevenlabs/webhook] Resolved session via fingerprint: incident=${resolvedIncidentId}`
        );
      } else {
        // Check for a recent real Twilio phone call not yet linked to a fingerprint.
        // ElevenLabs doesn't forward TwiML <Parameter> tags to the custom LLM, so we
        // scan bySid for a session registered by the Twilio webhook in the last 2 minutes.
        // This gives us the real CallSid for live transfer.
        const phoneSession = getRecentPhoneSession();
        if (phoneSession && !resolvedTwilioCallSid) {
          resolvedIncidentId = phoneSession.incident_id;
          resolvedCallSessionId = phoneSession.call_session_id;
          resolvedTwilioCallSid = phoneSession.twilio_call_sid ?? phoneSession.sid;
          updateVoiceSessionElevenLabsId(phoneSession.sid, fingerprint);
          sessionLookupKey = fingerprint;
          console.info(
            `[elevenlabs/webhook] Linked to Twilio phone session: incident=${resolvedIncidentId} sid=${resolvedTwilioCallSid}`
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
        sessionLookupKey = fingerprint;
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
        const sidForDb = twilioCallSid?.trim() || null;
        void (async () => {
          const ct = request.headers.get("content-type") ?? "(none)";
          const callerPhoneResolved = await resolveCallerPhoneJsonOrTwilio({
            rawJson: parsedBody,
            twilioCallSid: sidForDb,
          });
          console.info(
            `[elevenlabs/webhook] repositoryCallStart(new-call) content-type=${ct} ` +
              `CallSid=${sidForDb ?? "null"} elevenlabs_conversation_id=${autoConvKey} ` +
              `caller_phone=${redactPhone(callerPhoneResolved) ?? "null"}`
          );
          try {
            const started = await repositoryCallStart({
              mode: "normal",
              twilio_call_sid: sidForDb,
              elevenlabs_conversation_id: autoConvKey,
              caller_phone: callerPhoneResolved,
            });
            patchVoiceSessionIds(fingerprint, started.incident_id, started.call_session_id);
            if (conversationId && conversationId !== fingerprint) {
              patchVoiceSessionIds(conversationId, started.incident_id, started.call_session_id);
            }
            console.info(
              `[elevenlabs/webhook] ✅ Session patched: local=${localIncidentId} → real=${started.incident_id} (Supabase: ${started.incident_id !== localIncidentId ? "YES" : "in-memory"})`
            );
            resolveRealIds({
              incident_id: started.incident_id,
              call_session_id: started.call_session_id,
            });
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            console.error(
              `[elevenlabs/webhook] ❌ repositoryCallStart FAILED — all turns will NOT_FOUND. Error: ${errMsg}`
            );
            console.error(
              "[elevenlabs/webhook] → If error mentions 'relation does not exist', run your Supabase migration SQL."
            );
            console.error(
              "[elevenlabs/webhook] → If error mentions 'JWT expired' or 'Invalid API key', check SUPABASE_SERVICE_ROLE_KEY in .env.local."
            );
            resolveRealIds(null);
          }
        })();
        } // end else (no phone session found — new widget call)
      }
    }

    // Read cached triage state from the previous turn (populated async after
    // repositoryCallTurn resolves). This tells Featherless what has already
    // been gathered so it never asks for the same thing twice.
    const sessionKey = sessionLookupKey ?? conversationId ?? twilioCallSid ?? resolvedIncidentId;
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

    /** Context-aware fallback used when Featherless times out or errors.
     *  Always matches against the English-translated context but uses
     *  hardcoded bilingual phrases for common languages so the caller
     *  still hears their language if Featherless fails.
     */
    const voiceFallback = (ctx: string, turn: number, lang: string | null): string => {
      const c = ctx.toLowerCase();
      const hasFire = /fire|smoke|gas leak|gas|flood|fuego|incendio|feu|feuer/.test(c);
      const hasIntruder = /break.?in|intruder|shooting|stabbing|burglar|intruso|ladr/.test(c);
      const hasMedical = /medical|collapse|unconscious|trapped|accident|injur|hurt|chest pain|not breathing|médico|médica|blessé/.test(c);
      const hasEmergency = hasFire || hasIntruder || hasMedical || /emergency|emergencia|urgence/.test(c);

      // Bilingual hardcoded phrases for the most common caller languages
      type Phrases = { location: string; help: string; fire: string; intruder: string; medical: string };
      const PHRASES: Record<string, Phrases> = {
        es: {
          location: "¿Puede describirme qué pasó y dónde está? (Can you describe what happened and where you are?)",
          help: "Los servicios de emergencia han sido notificados. Quédese en línea. (Emergency services notified. Stay on the line.)",
          fire: "Evacúe si es seguro hacerlo. La ayuda está en camino. (Evacuate if safe. Help is on the way.)",
          intruder: "Escóndase y no confronte a nadie. La ayuda llega. (Hide and do not confront anyone. Help is coming.)",
          medical: "No mueva a la persona. La ayuda está en camino. (Do not move the person. Help is on the way.)",
        },
        fr: {
          location: "Pouvez-vous décrire ce qui s'est passé et où vous êtes ? (Can you describe what happened and where you are?)",
          help: "Les secours ont été alertés. Restez en ligne. (Emergency services notified. Stay on the line.)",
          fire: "Évacuez si c'est sans danger. Les secours arrivent. (Evacuate if safe. Help is on the way.)",
          intruder: "Cachez-vous et n'affrontez personne. Les secours arrivent. (Hide and do not confront anyone. Help is coming.)",
          medical: "Ne bougez pas la personne. Les secours arrivent. (Do not move the person. Help is on the way.)",
        },
        pt: {
          location: "Pode descrever o que aconteceu e onde você está? (Can you describe what happened and where you are?)",
          help: "Os serviços de emergência foram notificados. Fique na linha. (Emergency services notified. Stay on the line.)",
          fire: "Evacue se for seguro. A ajuda está a caminho. (Evacuate if safe. Help is on the way.)",
          intruder: "Esconda-se e não confronte ninguém. A ajuda está a caminho. (Hide. Help is coming.)",
          medical: "Não mova a pessoa. A ajuda está a caminho. (Do not move the person. Help is on the way.)",
        },
      };
      const p = lang ? PHRASES[lang] : null;

      if (!hasEmergency) {
        return p?.location ?? (turn === 1
          ? "Can you describe what happened and where you are?"
          : "Got it. Can you give me your exact location?");
      }
      if (turn === 1) return p?.location ?? "What is your exact location?";
      if (hasFire) return p?.fire ?? "Evacuate immediately if it is safe to do so. Emergency services have been notified and are on their way.";
      if (hasIntruder) return p?.intruder ?? "Find a safe place and stay hidden. Do not confront anyone. Help is on the way.";
      if (hasMedical) return p?.medical ?? "Stay calm and do not move the person. Keep them still. Help is on the way.";
      return p?.location ?? "Can you give me your exact location so we can help you?";
    };

    let sayToCaller: string;
    let voiceReplyProvider: "runtime" | "featherless_fallback" | "fallback" = "runtime";
    let shouldEnd = false;
    let runtimeResult: Awaited<ReturnType<typeof runEmergencyTurn>> | null = null;

    // Build the full conversation history (user + assistant) from the ElevenLabs message list.
    // Exclude the very last message (the current caller turn — passed separately as latestText).
    const conversationMessages = event.messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && (m.content ?? "").trim())
      .slice(0, -1)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content ?? "" }));

    const turnSessionKey = sessionLookupKey ?? conversationId ?? twilioCallSid ?? resolvedIncidentId;

    const runEmergencyVoiceFallback = async (reason: string): Promise<string> => {
      console.warn(`[elevenlabs/webhook] ${reason} -- trying Featherless emergency fallback`);
      try {
        const fallbackText = await Promise.race([
          generateVoiceReplyViaFeatherless(
            conversationMessages,
            reasoningText,
            translated.language,
            cachedTriageState
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("voice_timeout")), 8000)
          ),
        ]);
        voiceReplyProvider = "featherless_fallback";
        return fallbackText;
      } catch (fallbackError) {
        const fallbackReason =
          fallbackError instanceof Error ? fallbackError.message : "unknown";
        voiceReplyProvider = "fallback";
        console.warn(
          `[elevenlabs/webhook] Featherless emergency fallback failed (${fallbackReason}) -- using context fallback`
        );
        return voiceFallback(fullContext, turnNumber, translated.language ?? null);
      }
    };

    // Detect explicit caller transfer request BEFORE calling Featherless.
    const TRANSFER_RE = /\b(transfer|forward(?: my call| the call| me)?|connect me|speak to (a |an |)(human|operator|person|agent|someone)|talk to (a |an |)(human|operator|person|agent|someone)|real person|live (agent|person|operator)|put me through|non-emergency line|non emergency line)\b/i;
    const allUserLines = event.messages.filter((m) => m.role === "user").map((m) => m.content ?? "");
    const transferRequestCount = allUserLines.filter((t) => TRANSFER_RE.test(t)).length;
    const callerIsAskingForTransfer = TRANSFER_RE.test(latestUserText.trim()) && transferRequestCount >= 1;

    // Auto-transfer for non-emergency once triage has confirmed urgency + nothing missing.
    // Skip if transfer already requested/in-progress to avoid firing every turn.
    const transferPhrase = /non-emergency line|connect you to (an operator|a human)|transferring you/i;
    const alreadyTransferring =
      cachedTriageState?.operator_transfer_status === "requested" ||
      cachedTriageState?.operator_transfer_status === "transferred" ||
      cachedTriageState?.status === "transferring_to_operator" ||
      cachedTriageState?.control_state === "transferring" ||
      transferPhrase.test(cachedTriageState?.last_say_to_caller ?? "");
    const triageComplete =
      cachedTriageState?.urgency === "non_emergency" &&
      (!cachedTriageState?.missing_fields || cachedTriageState.missing_fields.length === 0);
    const autoTransferNonEmergency = triageComplete && substantiveUserMsgs.length >= 3 && !callerIsAskingForTransfer && !alreadyTransferring;

    const shouldTransfer = callerIsAskingForTransfer || autoTransferNonEmergency;

    if (shouldTransfer) {
      const reason = autoTransferNonEmergency
        ? `non-emergency auto-transfer (turn ${substantiveUserMsgs.length}, triage complete)`
        : `caller requested (${transferRequestCount} request(s))`;
      console.info(`[elevenlabs/webhook] Transfer triggered — ${reason}`);
    }

    voiceDebug("before-ai", {
      route: "/api/elevenlabs/webhook",
      path: "custom_llm_voice_reply",
      latestTranscript: shortText(reasoningText),
      incident_id: resolvedIncidentId,
      call_session_id: resolvedCallSessionId,
      ...voiceStateDebugFields(
        cachedTriageState,
        Math.max(conversationMessages.length, recentHistoryFor(cachedTriageState).length)
      ),
      provider: "runtime",
    });

    const runtimeIds = isNewCall
      ? await realIdsReady
      : resolvedIncidentId && resolvedCallSessionId
        ? {
            incident_id: resolvedIncidentId,
            call_session_id: resolvedCallSessionId,
          }
        : null;

    if (!runtimeIds) {
      sayToCaller = await runEmergencyVoiceFallback(
        "Unable to resolve incident/session IDs for llm_turn"
      );
    } else {
      try {
        runtimeResult = await runEmergencyTurn({
          incident_id: runtimeIds.incident_id,
          call_session_id: runtimeIds.call_session_id,
          speaker: "caller",
          text: latestUserText,
          is_final: true,
          source: VOICE_SOURCE_LABEL,
          language: translated.language,
          translated_text: translated.translated_text,
        });
        sayToCaller = runtimeResult.say_to_caller ?? SAFE_FALLBACK_PHRASE;
        shouldEnd =
          runtimeResult.actions.some((action) => action.action === "close_call_session") ||
          runtimeResult.call_session.status === "closed";
      } catch (e) {
        const reason = e instanceof Error ? e.message : "unknown";
        sayToCaller = await runEmergencyVoiceFallback(
          `runEmergencyTurn failed (${reason})`
        );
      }
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

    voiceDebug("after-ai", {
      route: "/api/elevenlabs/webhook",
      path: "custom_llm_voice_reply",
      say_to_caller: shortText(sayToCaller),
      provider: voiceReplyProvider,
      transcriptHistoryLength: runtimeResult
        ? turnSessionKey
          ? recentHistoryFor(
              getSessionByElevenLabsId(turnSessionKey)?.triage_state ??
                getSessionByTwilioSid(turnSessionKey)?.triage_state
            ).length
          : null
        : recentHistoryFor(cachedTriageState).length,
      urgency: runtimeResult?.incident.urgency ?? cachedTriageState?.urgency ?? null,
      summary: shortText(runtimeResult?.incident.summary ?? cachedTriageState?.summary),
      next_question: shortText(runtimeResult?.call_session.next_question ?? cachedTriageState?.next_question),
      last_question: shortText(
        runtimeResult
          ? lastQuestionFrom(runtimeResult.say_to_caller, runtimeResult.call_session.next_question)
          : cachedTriageState?.last_question
      ),
      missing_fields: runtimeResult?.incident.missing_fields ?? cachedTriageState?.missing_fields ?? null,
      collected_fields_keys: summarizeKeys(
        (runtimeResult?.incident.collected_fields as Record<string, string> | null | undefined) ??
          cachedTriageState?.collected_fields
      ),
      operator_required: runtimeResult?.incident.operator_required ?? cachedTriageState?.operator_required ?? null,
      should_escalate: runtimeResult?.call_session.should_escalate ?? cachedTriageState?.should_escalate ?? null,
      incident_patch_urgency: runtimeResult?.incident.urgency ?? null,
      incident_patch_incident_type: runtimeResult?.incident.incident_type ?? null,
      incident_patch_location: runtimeResult?.incident.location ?? null,
      incident_patch_missing_fields: runtimeResult?.incident.missing_fields ?? null,
      call_session_patch_next_question: runtimeResult?.call_session.next_question ?? null,
      call_session_patch_should_escalate: runtimeResult?.call_session.should_escalate ?? null,
      system_actions: runtimeResult?.actions.map((action) => action.action) ?? [],
      tool_requests: runtimeResult?.triage_trace?.first_pass_tool_requests.map((request) => request.tool) ?? [],
    });

    // Persist immediate voice memory after the runtime turn completes so fast
    // follow-up turns see the validated backend response.
    const nowIso = new Date().toISOString();
    if (turnSessionKey) {
      patchVoiceTriageState(turnSessionKey, {
        recent_transcript_history: [
          { role: "caller", text: reasoningText, created_at: nowIso },
          { role: "ai", text: sayToCaller, created_at: nowIso },
        ],
        last_say_to_caller: sayToCaller,
        last_question: runtimeResult
          ? lastQuestionFrom(runtimeResult.say_to_caller, runtimeResult.call_session.next_question)
          : lastQuestionFrom(sayToCaller),
        last_updated_at: nowIso,
        ...(runtimeResult
          ? {
              incident_type: runtimeResult.incident.incident_type ?? null,
              urgency: runtimeResult.incident.urgency ?? null,
              location: runtimeResult.incident.location ?? null,
              location_status: runtimeResult.incident.location_status ?? null,
              summary: runtimeResult.incident.summary ?? null,
              status: runtimeResult.incident.status ?? null,
              call_status: runtimeResult.call_session.status ?? null,
              control_state: runtimeResult.incident.control_state ?? null,
              ai_active:
                runtimeResult.call_session.ai_active ?? runtimeResult.incident.ai_active ?? null,
              operator_required: runtimeResult.incident.operator_required ?? null,
              should_escalate: runtimeResult.call_session.should_escalate ?? null,
              operator_transfer_status: runtimeResult.call_session.operator_transfer_status ?? null,
              next_question: runtimeResult.call_session.next_question ?? null,
              collected_fields:
                (runtimeResult.incident.collected_fields as Record<string, string> | null) ?? null,
              missing_fields: runtimeResult.incident.missing_fields ?? null,
            }
          : {}),
        ...(shouldTransfer ? { operator_transfer_status: "requested" as const } : {}),
      });
    }

    if (runtimeResult) {
      const inc = runtimeResult.incident;
      voiceDebug("after-merge", {
        route: "/api/elevenlabs/webhook",
        path: "runtime_llm_turn",
        say_to_caller: shortText(runtimeResult.say_to_caller),
        transcriptHistoryLength: turnSessionKey
          ? recentHistoryFor(
              getSessionByElevenLabsId(turnSessionKey)?.triage_state ??
                getSessionByTwilioSid(turnSessionKey)?.triage_state
            ).length
          : null,
        incident_id: inc.id,
        public_id: inc.public_id,
        call_session_id: runtimeResult.call_session.id,
        incident_type: inc.incident_type,
        urgency: inc.urgency,
        summary: shortText(inc.summary),
        status: inc.status,
        control_state: inc.control_state,
        location_status: inc.location_status,
        operator_required: inc.operator_required,
        location: shortText(inc.location, 100),
        collected_fields_keys: summarizeKeys(inc.collected_fields),
        missing_fields: inc.missing_fields,
        next_question: shortText(runtimeResult.call_session.next_question),
        last_question: shortText(
          lastQuestionFrom(runtimeResult.say_to_caller, runtimeResult.call_session.next_question)
        ),
        should_escalate: runtimeResult.call_session.should_escalate,
        operator_transfer_status: runtimeResult.call_session.operator_transfer_status,
        system_actions: runtimeResult.actions.map((action) => action.action),
        tool_requests:
          runtimeResult.triage_trace?.first_pass_tool_requests.map((request) => request.tool) ?? [],
        provider:
          runtimeResult.triage_trace?.pass2_provider ??
          runtimeResult.triage_trace?.pass1_provider ??
          null,
      });
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
      voiceDebug("before-ai", {
        route: "/api/elevenlabs/webhook",
        path: "transcript_event",
        latestTranscript: shortText(text),
        incident_id: entry.incident_id,
        call_session_id: entry.call_session_id,
        ...voiceStateDebugFields(
          entry.triage_state,
          recentHistoryFor(entry.triage_state).length
        ),
        provider: process.env.AI_PROVIDER ?? null,
      });

      const result = await repositoryCallTurn({
        incident_id: entry.incident_id,
        call_session_id: entry.call_session_id,
        speaker: "caller",
        text,
        is_final: true,
        source: VOICE_SOURCE_LABEL,
      });
      const inc = result.incident;
      const transcriptPatchTime = new Date().toISOString();
      patchVoiceTriageState(conversationId, {
        incident_type: inc.incident_type ?? null,
        urgency: inc.urgency ?? null,
        location: inc.location ?? null,
        location_status: inc.location_status ?? null,
        summary: inc.summary ?? null,
        status: inc.status ?? null,
        call_status: result.call_session.status ?? null,
        control_state: inc.control_state ?? null,
        ai_active: result.call_session.ai_active ?? inc.ai_active ?? null,
        operator_required: inc.operator_required ?? null,
        should_escalate: result.call_session.should_escalate ?? null,
        operator_transfer_status: result.call_session.operator_transfer_status ?? null,
        next_question: result.call_session.next_question ?? null,
        last_question: lastQuestionFrom(result.say_to_caller, result.call_session.next_question),
        last_say_to_caller: result.say_to_caller,
        recent_transcript_history: [
          { role: "caller", text, created_at: transcriptPatchTime },
          { role: "ai", text: result.say_to_caller ?? "", created_at: transcriptPatchTime },
        ],
        collected_fields: (inc.collected_fields as Record<string, string> | null) ?? null,
        missing_fields: inc.missing_fields ?? null,
        last_updated_at: transcriptPatchTime,
      });
      voiceDebug("after-merge", {
        route: "/api/elevenlabs/webhook",
        path: "transcript_event",
        say_to_caller: shortText(result.say_to_caller),
        transcriptHistoryLength: recentHistoryFor(entry.triage_state).length,
        incident_id: result.incident.id,
        public_id: result.incident.public_id,
        call_session_id: result.call_session.id,
        incident_type: result.incident.incident_type,
        urgency: result.incident.urgency,
        summary: shortText(result.incident.summary),
        status: result.incident.status,
        control_state: result.incident.control_state,
        location_status: result.incident.location_status,
        operator_required: result.incident.operator_required,
        location: shortText(result.incident.location, 100),
        collected_fields_keys: summarizeKeys(result.incident.collected_fields),
        missing_fields: result.incident.missing_fields,
        next_question: shortText(result.call_session.next_question),
        last_question: shortText(lastQuestionFrom(result.say_to_caller, result.call_session.next_question)),
        should_escalate: result.call_session.should_escalate,
        operator_transfer_status: result.call_session.operator_transfer_status,
        system_actions: result.actions.map((action) => action.action),
        tool_requests: result.triage_trace?.first_pass_tool_requests.map((request) => request.tool) ?? [],
        provider: result.triage_trace?.pass2_provider ?? result.triage_trace?.pass1_provider ?? null,
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
