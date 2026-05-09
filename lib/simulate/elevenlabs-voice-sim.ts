import type {
  CallStartRequest,
  CallTurnRequest,
  TriageTrace,
} from "@/lib/types/api";
import type { TriageAgentOutput } from "@/lib/ai/schemas/triageAgentOutputSchema";
import type { CallSession, Incident } from "@/lib/types/domain";
import type { AppMode } from "@/lib/types/enums";

/** `source` value for turns injected by this simulator (not real ElevenLabs webhooks). */
export const VOICE_SIM_SOURCE = "simulate" as const;

/**
 * Persisted-call path: `POST /api/call/turn` saves the caller turn to
 * `transcript_events`, runs `runCallTriageAgent` in `repositoryCallTurn`
 * (`lib/db/call-repository.ts`), then appends the agent `say_to_caller` line
 * as a second transcript row (`speaker: "ai"`) when triage runs on a final turn.
 *
 * Dry-run (same agent stack, no DB): `buildVoiceSimTriagePreviewBody` →
 * `POST /api/dev/triage-preview` → `runVoiceSimTriagePreview`
 * (`lib/simulate/voice-sim-triage-server.ts`). Client code must not import the agent directly.
 */

/** Body for {@link VoiceSimTriagePreviewResponse} from `POST /api/dev/triage-preview`. */
export type VoiceSimTriagePreviewRequestBody = {
  incident: Incident;
  call_session: CallSession;
  latest_transcript: string;
  transcript_history?: string[];
  mode?: AppMode;
  provider?: string | null;
};

export type VoiceSimTriagePreviewResponseBody = {
  triage: TriageAgentOutput;
};

export const buildVoiceSimTriagePreviewBody = (input: {
  incident: Incident;
  call_session: CallSession;
  latest_transcript: string;
  transcript_history?: string[];
  mode?: AppMode;
  provider?: string | null;
}): VoiceSimTriagePreviewRequestBody => ({
  incident: input.incident,
  call_session: input.call_session,
  latest_transcript: input.latest_transcript.trim(),
  transcript_history: input.transcript_history,
  mode: input.mode,
  provider: input.provider,
});

const randomSimId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * Builds a `POST /api/call/start` body similar to what you would map from an
 * ElevenLabs + Twilio session (demo IDs here are opaque strings).
 */
export const buildVoiceSimCallStart = (
  overrides?: Partial<CallStartRequest>
): CallStartRequest => ({
  mode: "normal",
  twilio_call_sid: randomSimId("sim_twilio"),
  elevenlabs_conversation_id: randomSimId("sim_elevenlabs"),
  ...overrides,
});

export type VoiceSimCallerTurnInput = {
  incident_id: string;
  call_session_id: string;
  text: string;
  /** STT "final" segment — triage runs only when true (see `repositoryCallTurn`). */
  is_final?: boolean;
  speaker?: CallTurnRequest["speaker"];
};

/**
 * Builds a `POST /api/call/turn` body: caller text as if ElevenLabs posted a transcript turn.
 */
export const buildVoiceSimCallerTurn = (
  input: VoiceSimCallerTurnInput
): CallTurnRequest => ({
  incident_id: input.incident_id,
  call_session_id: input.call_session_id,
  speaker: input.speaker ?? "caller",
  text: input.text,
  is_final: input.is_final ?? true,
  source: VOICE_SIM_SOURCE,
});

/**
 * Example caller lines for quick E2E clicks. Includes:
 *   - non-emergency theft (no tool loop)
 *   - urgent fire (no tool loop)
 *   - "demo geocode at <landmark>" — triggers the controlled two-pass tool loop
 *     in the mock agent (`mockCallTriageAgent`'s `geocodingDemo` path) so the
 *     simulator UI can show `triage_trace` end-to-end without Gemma.
 */
export const VOICE_SIM_SAMPLE_UTTERANCES: readonly string[] = [
  "Someone stole my bike near the library.",
  "There's smoke in my building and people are coughing.",
  "demo geocode at BMO Field",
  "demo geocode at Union Station",
  // IBM Multilingual Incident Layer — World Cup demo scripts
  "Mi hijo está perdido cerca de la puerta 3.",              // Spanish: lost child near Gate 3
  "J'ai besoin d'aide médicale près de l'entrée principale.", // French: medical help near main entrance
] as const;

/**
 * Re-exported so client components can render the trace without reaching past
 * the simulator boundary into `lib/types/api.ts` directly.
 */
export type VoiceSimTriageTrace = TriageTrace;

export const voiceSimStartForMode = (mode: AppMode): CallStartRequest =>
  buildVoiceSimCallStart({ mode });

/**
 * Convenience builder for the geocoding-demo two-pass loop. Pass-1 issues a
 * `geocode_location` tool request; pass-2 folds the geocode
 * result into the incident patch. See `mockCallTriageAgent` `geocodingDemo`
 * branch.
 */
export const buildVoiceSimDemoGeocodeTurn = (input: {
  incident_id: string;
  call_session_id: string;
  /** Defaults to "BMO Field". Anything matching `LANDMARKS` resolves cleanly. */
  landmark?: string;
}): CallTurnRequest =>
  buildVoiceSimCallerTurn({
    incident_id: input.incident_id,
    call_session_id: input.call_session_id,
    text: `demo geocode at ${input.landmark ?? "BMO Field"}`,
    is_final: true,
  });
