/**
 * lib/voice/smsClient.ts
 *
 * Sends SMS messages via the Twilio REST API.
 * Gracefully falls back to a stub (sent: false) when Twilio is not configured.
 *
 * Server-side only. Never expose Twilio credentials to the browser.
 * The backend route /api/operator/send-sms is the only caller in production.
 */

import { sendTwilioSms } from "./twilioClient";
import { twilioConfig } from "./voiceConfig";

export type SmsResult = {
  /** True when the SMS was actually sent to Twilio. */
  sent: boolean;
  /** Twilio message SID when sent successfully. */
  provider_message_id?: string;
  /** True when Twilio is not configured and the send was skipped. */
  stub: boolean;
  /** Error message if the send attempt failed. */
  error?: string;
};

/**
 * Sends an SMS message.
 *
 * When Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
 * TWILIO_PHONE_NUMBER not set), returns { sent: false, stub: true } without
 * throwing — the dashboard should display this honestly.
 *
 * @param to   Recipient phone number in E.164 format (e.g. +14155551234).
 * @param message  The SMS body. Keep under 160 chars to avoid multi-part SMS.
 */
export const sendSms = async (to: string, message: string): Promise<SmsResult> => {
  if (!twilioConfig.isConfigured) {
    console.info(
      "[smsClient] Twilio not configured — SMS stub. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER."
    );
    return { sent: false, stub: true };
  }

  if (!to || !to.startsWith("+")) {
    return {
      sent: false,
      stub: false,
      error: `Invalid recipient number: "${to}". Must be E.164 format (e.g. +14155551234).`,
    };
  }

  const result = await sendTwilioSms(to, message);

  if (!result.ok) {
    console.error("[smsClient] Twilio SMS failed:", result.error);
    return { sent: false, stub: false, error: result.error };
  }

  return {
    sent: true,
    stub: false,
    provider_message_id: result.messageSid,
  };
};

/**
 * Builds a short, factual SMS body for a non-emergency completed report.
 * Under 160 chars to avoid multi-part SMS fees.
 */
export const buildReportSms = (opts: {
  public_id: string | null;
  summary: string | null;
  location: string | null;
}): string => {
  const ref = opts.public_id ?? "your report";
  const loc = opts.location ? ` Location: ${opts.location}.` : "";
  const body = `Report received. Ref: ${ref}.${loc}`;
  return body.length <= 160 ? body : body.slice(0, 157) + "…";
};

/**
 * Builds a short, factual SMS body for an emergency escalation.
 */
export const buildEmergencySms = (opts: {
  public_id: string | null;
  location: string | null;
}): string => {
  const ref = opts.public_id ?? "your call";
  const loc = opts.location
    ? ` Location recorded: ${opts.location}.`
    : "";
  return `Emergency report received. Ref: ${ref}.${loc} Stay on the line if possible.`;
};

/**
 * Builds a short, factual SMS for a World Cup / event incident.
 */
export const buildEventSms = (opts: {
  public_id: string | null;
  summary: string | null;
  nearest_help?: string | null;
}): string => {
  const ref = opts.public_id ?? "your report";
  const help = opts.nearest_help ? ` Nearest help: ${opts.nearest_help}.` : "";
  return `Report received. Ref: ${ref}.${help} Help is on the way.`;
};
