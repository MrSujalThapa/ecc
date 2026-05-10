/**
 * lib/voice/elevenlabsWebhookParser.ts
 *
 * Parses incoming ElevenLabs webhook payloads into a normalised event shape.
 * Also provides HMAC-SHA256 signature verification.
 *
 * Server-side only — do not import from client components.
 */

import type {
  ElevenLabsLlmWebhookBody,
  ElevenLabsPostCallWebhookBody,
  ElevenLabsTranscriptEventBody,
} from "./elevenlabsTypes";

// ---------------------------------------------------------------------------
// Parsed event discriminated union
// ---------------------------------------------------------------------------

export type ParsedElevenLabsEvent =
  | {
      kind: "llm_turn";
      body: ElevenLabsLlmWebhookBody;
      /** The most recent caller utterance extracted from messages[]. */
      latestUserText: string;
      /** Full message history (system + prior turns). */
      messages: ElevenLabsLlmWebhookBody["messages"];
      /** Incident ID if passed via custom_llm_extra_body. */
      incidentId: string | null;
      /** Call session ID if passed via custom_llm_extra_body. */
      callSessionId: string | null;
      /** ElevenLabs conversation ID if included in extra body. */
      conversationId: string | null;
      /** Twilio call SID if included in extra body. */
      twilioCallSid: string | null;
    }
  | {
      kind: "post_call";
      body: ElevenLabsPostCallWebhookBody;
      conversationId: string;
    }
  | {
      kind: "transcript";
      body: ElevenLabsTranscriptEventBody;
      conversationId: string;
      text: string;
      isFinal: boolean;
      role: "user" | "agent";
    }
  | { kind: "unknown"; raw: unknown };

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parses any ElevenLabs webhook body into a typed event.
 * The caller is responsible for JSON.parse before passing here.
 */
export const parseElevenLabsEvent = (raw: unknown): ParsedElevenLabsEvent => {
  if (!raw || typeof raw !== "object") {
    return { kind: "unknown", raw };
  }

  const obj = raw as Record<string, unknown>;

  // --- Custom LLM webhook: has a "messages" array ---
  if (Array.isArray(obj.messages)) {
    const body = raw as ElevenLabsLlmWebhookBody;
    const messages = body.messages ?? [];

    // Last user message = what the caller just said
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const latestUserText = lastUser?.content ?? "";

    const extra = (body.custom_llm_extra_body ?? {}) as Record<string, unknown>;

    // ElevenLabs Custom LLM webhook encodes the conversation_id in the `model` field
    // (OpenAI chat.completions format). It may also appear at top level or in extra body.
    const modelField = body.model ?? null;
    const conversationId =
      body.conversation_id ??
      (extra.conversation_id as string | undefined) ??
      modelField ??
      null;

    const twilioCallSid =
      (extra.twilio_call_sid as string | undefined) ??
      (typeof obj.twilio_call_sid === "string" ? obj.twilio_call_sid : undefined) ??
      (typeof obj.twilioCallSid === "string" ? obj.twilioCallSid : undefined) ??
      (typeof obj.call_sid === "string" ? obj.call_sid : undefined) ??
      null;

    console.info(
      `[elevenlabsWebhookParser] llm_turn model=${modelField} conv_id=${conversationId} twilio_call_sid=${twilioCallSid ?? "null"} extra_keys=${Object.keys(extra).join(",") || "none"}`
    );

    return {
      kind: "llm_turn",
      body,
      latestUserText,
      messages,
      incidentId: (extra.incident_id as string) ?? null,
      callSessionId: (extra.call_session_id as string) ?? null,
      conversationId,
      twilioCallSid,
    };
  }

  // --- Post-call webhook ---
  if (typeof obj.type === "string" && obj.type === "post_call_webhook") {
    const body = raw as ElevenLabsPostCallWebhookBody;
    return {
      kind: "post_call",
      body,
      conversationId: body.data?.conversation_id ?? "",
    };
  }

  // --- Real-time transcript / utterance events ---
  if (
    typeof obj.type === "string" &&
    (obj.type === "utterance" || obj.type.includes("transcript"))
  ) {
    const body = raw as ElevenLabsTranscriptEventBody;
    const text = (body.message ?? body.transcript ?? "").trim();
    return {
      kind: "transcript",
      body,
      conversationId: body.conversation_id ?? "",
      text,
      isFinal: body.is_final ?? true,
      role: body.role === "agent" ? "agent" : "user",
    };
  }

  return { kind: "unknown", raw };
};

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Verifies the HMAC-SHA256 signature sent by ElevenLabs in the
 * `elevenlabs-signature` (or similar) request header.
 *
 * Returns true when:
 *   - No secret is configured (webhook verification is disabled).
 *   - The provided signature matches the computed HMAC.
 *
 * Returns false when a secret IS configured but the signature does not match.
 */
export const verifyElevenLabsSignature = async (
  signature: string | null,
  rawBody: string,
  secret: string
): Promise<boolean> => {
  // If no secret is configured, skip verification (dev/demo mode).
  if (!secret) return true;
  // Secret configured but no signature provided — reject.
  if (!signature) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signedBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody)
    );

    const expectedHex = Array.from(new Uint8Array(signedBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison to avoid timing attacks
    const sigHex = signature.replace(/^sha256=/, "");
    if (expectedHex.length !== sigHex.length) return false;

    let diff = 0;
    for (let i = 0; i < expectedHex.length; i++) {
      diff |= expectedHex.charCodeAt(i) ^ sigHex.charCodeAt(i);
    }
    return diff === 0;
  } catch (e) {
    console.error("[elevenlabsWebhookParser] signature verification error:", e);
    return false;
  }
};
