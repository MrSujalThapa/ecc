/**
 * lib/voice/twilioClient.ts
 *
 * Server-side Twilio helpers: TwiML builders and Twilio REST API wrappers.
 * Uses native fetch — no Twilio SDK required.
 *
 * All functions are server-side only. Never import from client components.
 * Never expose TWILIO_AUTH_TOKEN or TWILIO_ACCOUNT_SID to the browser.
 */

import { elevenLabsConfig, twilioConfig } from "./voiceConfig";

// ---------------------------------------------------------------------------
// TwiML builders
// ---------------------------------------------------------------------------

const escapeXml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/**
 * Returns TwiML that connects the Twilio call to an ElevenLabs Conversational
 * AI agent via WebSocket Media Stream.
 *
 * Uses the ElevenLabs Twilio-specific WebSocket endpoint with <Parameter> tags
 * so that:
 *   1. The call appears in ElevenLabs conversation history (agent tracking)
 *   2. The agent_id, incident_id, and call_session_id are passed as conversation
 *      context that the custom LLM webhook can read from custom_llm_extra_body
 *
 * If a signed URL is supplied (from createElevenLabsConversation), it is used
 * directly — ElevenLabs signed URLs already embed the agent ID and conversation
 * tracking, so no extra Parameters are needed.
 */
export const buildTwimlConnectElevenLabs = (opts: {
  agentId?: string;
  signedUrl?: string | null;
  incidentId?: string | null;
  callSessionId?: string | null;
} = {}): string => {
  const agentId = opts.agentId ?? elevenLabsConfig.agentId;

  // If ElevenLabs gave us a signed URL (pre-created conversation), use it directly.
  // Signed URLs embed a real conversation_id, so the conversation appears in history.
  if (opts.signedUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(opts.signedUrl)}" />
  </Connect>
</Response>`;
  }

  // No signed URL — use the stable ElevenLabs agent WebSocket URL.
  const streamUrl = `wss://api.elevenlabs.io/v1/convai/call?agent_id=${encodeURIComponent(agentId)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(streamUrl)}" />
  </Connect>
</Response>`;
};

/**
 * Returns TwiML that transfers the call to a phone number.
 * Used for the emergency operator transfer path.
 */
export const buildTwimlTransfer = (operatorNumber: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>${escapeXml(operatorNumber)}</Dial>
</Response>`;

/**
 * Returns TwiML that speaks a message to the caller and hangs up.
 * Used as a fallback when ElevenLabs is not configured.
 */
export const buildTwimlSayAndHangup = (
  text: string,
  voice = "Polly.Joanna"
): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${escapeXml(text)}</Say>
  <Hangup />
</Response>`;

/** Returns TwiML that immediately hangs up. */
export const buildTwimlHangup = (): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup />
</Response>`;

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

type TwilioApiResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

const twilioRequest = async <T = unknown>(
  path: string,
  method: "POST" | "GET",
  body?: URLSearchParams
): Promise<TwilioApiResult<T>> => {
  if (!twilioConfig.isConfigured) {
    return { ok: false, error: "Twilio not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER" };
  }

  const credentials = Buffer.from(
    `${twilioConfig.accountSid}:${twilioConfig.authToken}`
  ).toString("base64");

  const url = `https://api.twilio.com${path}`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${credentials}`,
        ...(body
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
      body: body?.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText, status: res.status };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Twilio request failed",
    };
  }
};

// ---------------------------------------------------------------------------
// Twilio REST API actions
// ---------------------------------------------------------------------------

/**
 * Redirect an in-flight Twilio call to new TwiML.
 * Used to trigger the emergency transfer while the call is live.
 */
export const redirectTwilioCall = async (
  callSid: string,
  twiml: string
): Promise<{ ok: boolean; error?: string }> => {
  const body = new URLSearchParams({ Twiml: twiml });
  const result = await twilioRequest(
    `/2010-04-01/Accounts/${twilioConfig.accountSid}/Calls/${callSid}.json`,
    "POST",
    body
  );
  return { ok: result.ok, error: result.ok ? undefined : result.error };
};

/**
 * Send an SMS via Twilio REST API.
 * Returns the Twilio message SID on success.
 */
export const sendTwilioSms = async (
  to: string,
  body: string
): Promise<{ ok: boolean; messageSid?: string; error?: string }> => {
  if (!twilioConfig.phoneNumber) {
    return { ok: false, error: "TWILIO_PHONE_NUMBER not set" };
  }
  const params = new URLSearchParams({
    To: to,
    From: twilioConfig.phoneNumber,
    Body: body,
  });
  const result = await twilioRequest<{ sid?: string }>(
    `/2010-04-01/Accounts/${twilioConfig.accountSid}/Messages.json`,
    "POST",
    params
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, messageSid: result.data.sid };
};

// ---------------------------------------------------------------------------
// ElevenLabs conversation creation (optional — for signed URL / dynamic vars)
// ---------------------------------------------------------------------------

/**
 * Creates an ElevenLabs conversation via API and returns a signed URL
 * and the conversation_id.
 *
 * This allows passing dynamic variables (e.g. incident_id, call_session_id)
 * into the agent context so the custom LLM webhook can identify the session.
 *
 * Returns null if ElevenLabs is not configured.
 */
/**
 * For Twilio phone calls, we no longer pre-create a conversation via the signed
 * URL endpoint — that endpoint is for browser widget sessions and doesn't give
 * ElevenLabs enough context to properly track phone calls in conversation history.
 *
 * Instead, the Twilio webhook now passes agent_id + context directly via
 * <Parameter> tags in the TwiML <Stream>, using the ElevenLabs Twilio endpoint
 * wss://api.elevenlabs.io/v1/convai/twilio. This ensures:
 *   - Conversation appears in ElevenLabs history under the correct agent
 *   - ElevenLabs post-call webhook fires after the call ends
 *
 * This function is kept for compatibility but returns null so the caller falls
 * back to the <Parameter>-based TwiML path.
 */
export const createElevenLabsConversation = async (_opts: {
  incident_id: string;
  call_session_id: string;
  mode?: string;
}): Promise<{
  conversation_id: string;
  signed_url: string;
} | null> => {
  // Always use the Twilio WebSocket + Parameter approach for phone calls.
  // See buildTwimlConnectElevenLabs for details.
  return null;
};

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Parses a Twilio webhook body (application/x-www-form-urlencoded) into a
 * plain object.
 */
export const parseTwilioFormBody = async (
  request: Request
): Promise<Record<string, string>> => {
  try {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  } catch {
    return {};
  }
};
