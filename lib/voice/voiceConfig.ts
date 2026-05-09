/**
 * lib/voice/voiceConfig.ts
 *
 * Server-side only — environment variable accessors for Twilio and ElevenLabs.
 * Never import from client components or expose these values to the browser.
 *
 * Fill in the corresponding keys in .env.local to enable live voice/telephony.
 * The demo runs without these keys using stub/mock fallbacks.
 */

// ---------------------------------------------------------------------------
// Twilio config
// ---------------------------------------------------------------------------

export const twilioConfig = {
  get accountSid(): string {
    return process.env.TWILIO_ACCOUNT_SID ?? "";
  },
  get authToken(): string {
    return process.env.TWILIO_AUTH_TOKEN ?? "";
  },
  /** The Twilio phone number that callers dial (E.164 format, e.g. +14155551234). */
  get phoneNumber(): string {
    return process.env.TWILIO_PHONE_NUMBER ?? "";
  },
  /** The operator's real phone number that emergency calls transfer to. */
  get operatorForwardNumber(): string {
    return process.env.TWILIO_OPERATOR_FORWARD_NUMBER ?? "";
  },
  /** True when account SID, auth token, and phone number are all set. */
  get isConfigured(): boolean {
    return Boolean(this.accountSid && this.authToken && this.phoneNumber);
  },
};

// ---------------------------------------------------------------------------
// ElevenLabs config
// ---------------------------------------------------------------------------

export const elevenLabsConfig = {
  get apiKey(): string {
    return process.env.ELEVENLABS_API_KEY ?? "";
  },
  /** The ElevenLabs Conversational AI agent ID. */
  get agentId(): string {
    return process.env.ELEVENLABS_AGENT_ID ?? "";
  },
  /**
   * Optional HMAC secret used to verify webhook signatures from ElevenLabs.
   * Set this in the ElevenLabs agent webhook config and in .env.local.
   */
  get webhookSecret(): string {
    return process.env.ELEVENLABS_WEBHOOK_SECRET ?? "";
  },
  /** True when API key and agent ID are both set. */
  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.agentId);
  },
};

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/**
 * Safe fallback phrase spoken to the caller when the backend returns no
 * say_to_caller text or when an unexpected error occurs.
 * Keep it short, neutral, and caller-safe.
 */
export const SAFE_FALLBACK_PHRASE =
  "I want to make sure I understood correctly. Can you briefly explain what happened?";

/**
 * The source label attached to transcript turns originating from a real
 * Twilio + ElevenLabs call (as opposed to simulation or dev-harness).
 */
export const VOICE_SOURCE_LABEL = "elevenlabs" as const;
