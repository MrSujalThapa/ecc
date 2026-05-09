/**
 * lib/voice/callRouting.ts
 *
 * Interprets backend /api/call/turn responses and decides the next voice action.
 *
 * Rules (in priority order):
 *   1. system_actions containing transfer_to_operator → transfer
 *   2. system_actions containing close_call_session   → end
 *   3. call_session.should_escalate + operator_transfer_status === "requested" → transfer
 *   4. call_session.status === "closed"               → end
 *   5. Default → say the backend's say_to_caller or next_question
 *
 * The voice layer must never make routing decisions based on raw transcript text.
 * All decisions derive from backend-validated state.
 */

import type { CallTurnResponse } from "@/lib/types/api";
import type { ElevenLabsLlmResponse } from "./elevenlabsTypes";
import { SAFE_FALLBACK_PHRASE } from "./voiceConfig";

// ---------------------------------------------------------------------------
// Voice action type
// ---------------------------------------------------------------------------

export type VoiceAction =
  | { type: "say"; text: string }
  | { type: "transfer"; reason: string }
  | { type: "end"; reason: string };

// ---------------------------------------------------------------------------
// Main routing function
// ---------------------------------------------------------------------------

/**
 * Given a /api/call/turn response, returns the next voice action.
 * Never throws — falls back to a safe phrase if the response is malformed.
 */
export const getNextVoiceAction = (response: CallTurnResponse): VoiceAction => {
  const { call_session, actions = [], say_to_caller } = response;

  // 1. Explicit system actions take highest priority
  for (const action of actions) {
    if (action.action === "transfer_to_operator") {
      return { type: "transfer", reason: action.reason ?? "operator_required" };
    }
    if (action.action === "close_call_session") {
      return { type: "end", reason: action.reason ?? "completed" };
    }
  }

  // 2. Session escalation flag
  if (
    call_session.should_escalate &&
    call_session.operator_transfer_status === "requested"
  ) {
    return { type: "transfer", reason: "operator_escalation" };
  }

  // 3. Session already closed
  if (call_session.status === "closed") {
    return { type: "end", reason: "session_closed" };
  }

  // 4. Default: speak the backend's phrase
  const text =
    say_to_caller ??
    call_session.next_question ??
    SAFE_FALLBACK_PHRASE;

  return { type: "say", text };
};

// ---------------------------------------------------------------------------
// ElevenLabs response formatters
// ---------------------------------------------------------------------------

/**
 * Wraps a response string in the OpenAI chat.completions JSON shape that
 * ElevenLabs' custom LLM webhook expects.
 */
export const buildElevenLabsLlmResponse = (
  text: string
): ElevenLabsLlmResponse => ({
  id: `chatcmpl-${Date.now()}`,
  object: "chat.completion",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: text },
      finish_reason: "stop",
    },
  ],
});

/**
 * Serializes an ElevenLabsLlmResponse to JSON string.
 * Use this when building the HTTP response body.
 */
export const serializeElevenLabsResponse = (text: string): string =>
  JSON.stringify(buildElevenLabsLlmResponse(text));

// ---------------------------------------------------------------------------
// Demo scripts — safe multi-turn transcripts for rehearsed demo calls
// ---------------------------------------------------------------------------

/**
 * Short caller scripts used for demo reliability testing (M2-Phase 9).
 * Each entry has a mode tag and a sequence of caller lines.
 */
export const DEMO_CALL_SCRIPTS = {
  normal_non_emergency: [
    "Someone stole my bike near the central library.",
    "It was a blue mountain bike, stolen about an hour ago.",
    "I didn't see who took it. I don't have their contact info.",
  ],
  normal_emergency: [
    "Someone just broke into my house.",
    "I'm at 42 Maple Street, apartment 3B.",
    "I can hear them downstairs. Please send help.",
  ],
  disaster_trapped: [
    "There was an earthquake. I'm trapped under debris.",
    "I'm at the corner of King and Bay Street.",
    "I can move my arms but my legs are stuck.",
  ],
  world_cup_lost_tourist: [
    "I'm lost near the stadium and I don't speak English well.",
    "Me llamo Carlos. Estoy cerca de la Puerta 7.",
    "No sé dónde está mi grupo.",
  ],
  world_cup_medical: [
    "My friend collapsed near Gate 3. He's not responding.",
    "We're at the north fan zone, near the food vendors.",
    "He's breathing but unconscious.",
  ],
} as const;
