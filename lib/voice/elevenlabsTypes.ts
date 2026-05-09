/**
 * lib/voice/elevenlabsTypes.ts
 *
 * TypeScript types for ElevenLabs Conversational AI webhook payloads.
 *
 * ElevenLabs sends three kinds of events to your backend:
 *
 * 1. Custom LLM webhook — real-time per-turn call to your LLM endpoint.
 *    ElevenLabs sends the conversation messages; your backend returns the
 *    next assistant response. This is the main real-time integration point.
 *
 * 2. Real-time transcript event — transcript turns sent during the call
 *    (if configured in the agent settings as utterance/transcript events).
 *
 * 3. Post-call webhook — full conversation summary after the call ends.
 */

// ---------------------------------------------------------------------------
// 1. Custom LLM webhook (real-time, per turn)
// ---------------------------------------------------------------------------

export type ElevenLabsLlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Body ElevenLabs sends to your custom LLM webhook URL for each conversation turn.
 *
 * `custom_llm_extra_body` carries extra fields configured in the ElevenLabs
 * agent setup. We use this to pass incident_id and call_session_id from the
 * signed URL created at call-start time so the backend can look up the session.
 */
export type ElevenLabsLlmWebhookBody = {
  /**
   * ElevenLabs encodes the conversation_id inside the `model` field of every
   * Custom LLM webhook request (OpenAI chat.completions format).
   * e.g. model = "conv_01jv..."
   */
  model?: string;
  /** ElevenLabs may also send conversation_id at the top level in some flows. */
  conversation_id?: string;
  messages: ElevenLabsLlmMessage[];
  max_tokens?: number;
  stream?: boolean;
  stream_options?: Record<string, unknown>;
  temperature?: number;
  conversation_config_override?: Record<string, unknown>;
  /** Extra fields injected when the conversation was created via signed URL. */
  custom_llm_extra_body?: {
    incident_id?: string;
    call_session_id?: string;
    conversation_id?: string;
    twilio_call_sid?: string;
    [key: string]: unknown;
  };
};

/**
 * Non-streaming response format ElevenLabs expects from the custom LLM endpoint.
 * This follows the OpenAI chat completions shape.
 */
export type ElevenLabsLlmResponse = {
  id: string;
  object: "chat.completion";
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: "stop";
  }>;
};

// ---------------------------------------------------------------------------
// 2. Real-time transcript / utterance events
// ---------------------------------------------------------------------------

export type ElevenLabsTranscriptEventBody = {
  type: "utterance" | "conversation.transcript" | string;
  conversation_id: string;
  agent_id?: string;
  /** "user" = caller, "agent" = ElevenLabs TTS */
  role?: "user" | "agent";
  /** The transcript text for this turn. */
  message?: string;
  /** Alternative field name for the transcript text. */
  transcript?: string;
  /** True when this is a completed (final) transcript segment. */
  is_final?: boolean;
  time_in_call_secs?: number;
};

// ---------------------------------------------------------------------------
// 3. Post-call webhook
// ---------------------------------------------------------------------------

export type ElevenLabsPostCallTranscriptEntry = {
  role: "user" | "agent";
  message: string;
  time_in_call_secs?: number;
};

export type ElevenLabsPostCallWebhookBody = {
  type: "post_call_webhook";
  event_timestamp: number;
  data: {
    conversation_id: string;
    agent_id: string;
    status: "done" | "error";
    transcript?: ElevenLabsPostCallTranscriptEntry[];
    metadata?: Record<string, unknown>;
    analysis?: Record<string, unknown>;
  };
};

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

export type ElevenLabsWebhookBody =
  | ElevenLabsLlmWebhookBody
  | ElevenLabsTranscriptEventBody
  | ElevenLabsPostCallWebhookBody;
