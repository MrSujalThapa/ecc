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
 * If a pre-created signed URL is available (from ElevenLabs API), pass it as
 * `signedUrl` — this allows dynamic per-call agent config.
 * Falls back to the static agent URL using ELEVENLABS_AGENT_ID.
 */
export const buildTwimlConnectElevenLabs = (opts: {
  agentId?: string;
  signedUrl?: string | null;
} = {}): string => {
  const agentId = opts.agentId ?? elevenLabsConfig.agentId;
  const streamUrl =
    opts.signedUrl ??
    `wss://api.elevenlabs.io/v1/convai/call?agent_id=${encodeURIComponent(agentId)}`;

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
 * Fetches an in-progress or completed call resource and returns the caller's `from`
 * number (E.164 when PSTN). Used when webhooks include CallSid but omit From.
 */
export const fetchTwilioCallCallerFrom = async (
  callSid: string
): Promise<string | null> => {
  const sid = callSid.trim();
  if (!sid) return null;

  const path = `/2010-04-01/Accounts/${twilioConfig.accountSid}/Calls/${encodeURIComponent(sid)}.json`;
  const result = await twilioRequest<{ from?: string }>(path, "GET");
  if (!result.ok) {
    console.warn(
      `[twilioClient] fetchTwilioCallCallerFrom failed sid=${sid}: ${result.error}`
    );
    return null;
  }
  const raw = result.data.from;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
};

/** Redirect an in-flight Twilio call to new TwiML (operator transfer). */
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
export const createElevenLabsConversation = async (opts: {
  incident_id: string;
  call_session_id: string;
  mode?: string;
}): Promise<{
  conversation_id: string;
  signed_url: string;
} | null> => {
  if (!elevenLabsConfig.isConfigured) {
    return null;
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(elevenLabsConfig.agentId)}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": elevenLabsConfig.apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      console.error(
        "[twilioClient] ElevenLabs signed URL failed:",
        res.status,
        await res.text()
      );
      return null;
    }

    const data = (await res.json()) as {
      signed_url?: string;
      conversation_id?: string;
    };

    if (!data.signed_url) return null;

    // Append context params so the custom LLM webhook can look up the session.
    const urlWithContext = `${data.signed_url}&incident_id=${encodeURIComponent(opts.incident_id)}&call_session_id=${encodeURIComponent(opts.call_session_id)}`;

    return {
      signed_url: urlWithContext,
      conversation_id: data.conversation_id ?? "",
    };
  } catch (e) {
    console.error("[twilioClient] createElevenLabsConversation error:", e);
    return null;
  }
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
