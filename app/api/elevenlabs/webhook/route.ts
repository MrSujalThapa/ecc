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
  history: string[],
  latestText: string
): Promise<string> => {
  const key = process.env.FEATHERLESS_API_KEY?.trim();
  const model = process.env.FEATHERLESS_MODEL?.trim() ?? "google/gemma-3-4b-it";
  const base = process.env.FEATHERLESS_BASE_URL?.trim() ?? "https://api.featherless.ai/v1";
  if (!key) throw new Error("FEATHERLESS_API_KEY not set");

  const historyLines = history.length > 0
    ? `Previous caller messages:\n${history.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n`
    : "";
  const userMessage = `${historyLines}Latest caller message: "${latestText}"\n\nWhat do you say to the caller?`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: VOICE_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
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
} from "@/lib/voice/voiceSessionStore";
import { enrichTranscriptWithIbmTranslation } from "@/lib/voice/transcriptTranslation";

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
            `[elevenlabs/webhook] Session patched: local=${localIncidentId} → supabase=${started.incident_id}`
          );
        }).catch((e) =>
          console.error("[elevenlabs/webhook] async call/start error:", e)
        );
      }
    }

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
    const translated = await enrichTranscriptWithIbmTranslation({
      text: latestUserText,
      isFinal: true,
    });
    const reasoningText = translated.translated_text ?? latestUserText;
    if (translated.language && translated.language !== "en") {
      console.info(
        `[elevenlabs/webhook] IBM translation: lang=${translated.language} provider=${translated.translation_provider}`
      );
    }

    /** Context-aware fallback used when Gemma times out or errors. */
    const voiceFallback = (ctx: string, turn: number): string => {
      const c = ctx.toLowerCase();
      const hasFire     = /fire|smoke|gas leak|gas|flood/.test(c);
      const hasIntruder = /break.?in|intruder|shooting|stabbing|burglar/.test(c);
      const hasMedical  = /medical|collapse|unconscious|trapped|accident|injur|hurt|chest pain|not breathing/.test(c);
      const hasEmergency = hasFire || hasIntruder || hasMedical || /emergency/.test(c);

      if (!hasEmergency) {
        return turn === 1
          ? "Can you describe what happened and where you are?"
          : "Got it. Can you give me your exact location?";
      }
      if (turn === 1) return "What is your exact location?";
      if (hasFire)     return "Evacuate immediately if it is safe to do so. Emergency services have been notified and are on their way.";
      if (hasIntruder) return "Find a safe place and stay hidden. Do not confront anyone. Help is on the way.";
      if (hasMedical)  return "Stay calm and do not move the person. Keep them still. Help is on the way.";
      return "Emergency services have been notified. Stay on the line.";
    };

    let sayToCaller: string;
    let shouldTransfer = false;
    let shouldEnd = false;

    try {
      const transcriptHistory = substantiveUserMsgs.slice(0, -1);

      // Direct lightweight Featherless call — minimal prompt, no tool catalog, no schema validation.
      // No mock fallback. If Featherless fails or times out, voiceFallback fires below.
      sayToCaller = await Promise.race([
        generateVoiceReplyViaFeatherless(transcriptHistory, reasoningText),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("voice_timeout")), 8000)
        ),
      ]);

      console.info(`[elevenlabs/webhook] Featherless voice reply (${sayToCaller.length} chars)`);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "unknown";
      console.warn(`[elevenlabs/webhook] Featherless ${reason === "voice_timeout" ? "timed out (>8s)" : `error: ${reason}`} — using context fallback`);
      sayToCaller = voiceFallback(fullContext, turnNumber);
    }

    // Persist transcript + incident update async — don't block the voice response
    void repositoryCallTurn({
      incident_id: resolvedIncidentId,
      call_session_id: resolvedCallSessionId,
      speaker: "caller",
      text: latestUserText,
      is_final: true,
      source: VOICE_SOURCE_LABEL,
      language: translated.language,
      translated_text: translated.translated_text,
    }).catch((e) =>
      console.error("[elevenlabs/webhook] async call/turn error:", e)
    );

    // Decide next voice action from fast AI output
    const action = shouldTransfer
      ? { type: "transfer" as const, reason: "operator_required" }
      : shouldEnd
      ? { type: "end" as const, reason: "completed" }
      : { type: "say" as const, text: sayToCaller };

    if (action.type === "transfer") {
      // Trigger emergency transfer asynchronously (don't block the ElevenLabs response)
      if (resolvedTwilioCallSid) {
        void triggerTransfer({
          twilio_call_sid: resolvedTwilioCallSid,
          incident_id: resolvedIncidentId,
          call_session_id: resolvedCallSessionId,
          baseUrl: getBaseUrl(request),
        });
      } else {
        console.warn(
          "[elevenlabs/webhook] Transfer needed but no twilio_call_sid available."
        );
      }

      // Tell the caller they are being transferred before the transfer completes
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

    // Default: say the backend's phrase
    return buildLlmResponse(action.text, wantsStream);
  }

  // -------------------------------------------------------------------------
  // 2. Real-time transcript event
  // -------------------------------------------------------------------------
  if (event.kind === "transcript") {
    const { conversationId, text, isFinal, role } = event;

    if (!isFinal || role !== "user" || !text.trim()) {
      // Partial transcripts or agent turns — store if needed but don't run AI
      return NextResponse.json({ ok: true, note: "partial or agent turn — skipped" });
    }

    // Resolve session
    const entry = getSessionByElevenLabsId(conversationId);
    if (!entry) {
      console.warn(
        `[elevenlabs/webhook] Transcript event: no session for conv_id=${conversationId}`
      );
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

  // -------------------------------------------------------------------------
  // 3. Post-call webhook — conversation ended
  // -------------------------------------------------------------------------
  if (event.kind === "post_call") {
    const { conversationId } = event;
    const entry = getSessionByElevenLabsId(conversationId);

    if (!entry) {
      console.warn(
        `[elevenlabs/webhook] Post-call: no session for conv_id=${conversationId}`
      );
      return NextResponse.json({ ok: true, note: "session not found" });
    }

    try {
      await repositoryCallEnd({
        incident_id: entry.incident_id,
        call_session_id: entry.call_session_id,
        reason: "completed",
      });
      console.info(
        `[elevenlabs/webhook] Post-call: closed session incident=${entry.incident_id}`
      );
    } catch (e) {
      console.error("[elevenlabs/webhook] post-call call/end error:", e);
    }

    return NextResponse.json({ ok: true });
  }

  // Unknown event type — log and return 200 so ElevenLabs doesn't retry
  return NextResponse.json({ ok: true, note: "unknown event" });
};
