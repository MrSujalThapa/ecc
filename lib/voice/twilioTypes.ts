/**
 * lib/voice/twilioTypes.ts
 *
 * TypeScript types for Twilio webhook request bodies.
 * Twilio sends all webhooks as application/x-www-form-urlencoded POST requests.
 */

export type TwilioCallStatus =
  | "queued"
  | "ringing"
  | "in-progress"
  | "completed"
  | "busy"
  | "failed"
  | "no-answer"
  | "canceled";

/** Body sent by Twilio when an inbound call arrives. */
export type TwilioInboundCallPayload = {
  /** Unique identifier for the call. Preserve in CallSession.twilio_call_sid. */
  CallSid: string;
  AccountSid: string;
  /** Caller's phone number in E.164 format. */
  From: string;
  /** Your Twilio phone number. */
  To: string;
  CallStatus: TwilioCallStatus;
  ApiVersion: string;
  Direction: "inbound" | "outbound-api" | "outbound-dial";
  ForwardedFrom?: string;
  CallerCountry?: string;
  CalledCountry?: string;
};

/** Body sent by Twilio for call status callbacks (statusCallback URL). */
export type TwilioCallStatusPayload = {
  CallSid: string;
  CallStatus: TwilioCallStatus;
  /** Duration of the call in seconds (available after completion). */
  CallDuration?: string;
  From: string;
  To: string;
  AccountSid: string;
  RecordingUrl?: string;
  RecordingSid?: string;
};

/** Terminal statuses — when received, the backend call session should be closed. */
export const TWILIO_TERMINAL_STATUSES: ReadonlySet<TwilioCallStatus> = new Set([
  "completed",
  "busy",
  "failed",
  "no-answer",
  "canceled",
]);

export const isTwilioCallTerminal = (status: TwilioCallStatus | string): boolean =>
  TWILIO_TERMINAL_STATUSES.has(status as TwilioCallStatus);
