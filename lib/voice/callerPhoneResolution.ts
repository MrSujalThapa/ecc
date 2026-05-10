/**
 * Resolves inbound caller phone (E.164 or Twilio-style string) from webhook JSON
 * or Twilio Calls API. Server-only.
 */

import { fetchTwilioCallCallerFrom } from "./twilioClient";

const trimPhone = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

const CANDIDATE_KEYS = [
  "From",
  "from",
  "caller_phone",
  "callerPhone",
  "phone_number",
  "phoneNumber",
  "Caller",
  "caller",
];

export function extractCallerPhoneFromFlatRecord(
  rec: Record<string, unknown>
): string | null {
  for (const k of CANDIDATE_KEYS) {
    const p = trimPhone(rec[k]);
    if (p) return p;
  }
  return null;
}

function extractCallerPhoneFromRecordDeep(
  rec: Record<string, unknown>,
  depth: number
): string | null {
  if (depth <= 0) return null;
  const direct = extractCallerPhoneFromFlatRecord(rec);
  if (direct) return direct;

  const nestedKeys = [
    "metadata",
    "custom_llm_extra_body",
    "conversation_initiation_client_data",
    "dynamic_variables",
    "client_data",
    "user_info",
  ];
  for (const nk of nestedKeys) {
    const child = rec[nk];
    if (child && typeof child === "object" && !Array.isArray(child)) {
      const inner = extractCallerPhoneFromRecordDeep(
        child as Record<string, unknown>,
        depth - 1
      );
      if (inner) return inner;
    }
  }
  return null;
}

/** Scan typical ElevenLabs / telephony JSON shapes for a caller number. */
export function extractCallerPhoneFromJsonPayload(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return extractCallerPhoneFromRecordDeep(raw as Record<string, unknown>, 5);
}

export async function resolveCallerPhoneJsonOrTwilio(opts: {
  rawJson?: unknown;
  twilioCallSid?: string | null;
}): Promise<string | null> {
  const fromJson =
    opts.rawJson !== undefined
      ? extractCallerPhoneFromJsonPayload(opts.rawJson)
      : null;
  if (fromJson) return fromJson;
  const sid = opts.twilioCallSid?.trim();
  if (sid && sid.startsWith("CA")) {
    return fetchTwilioCallCallerFrom(sid);
  }
  return null;
}
