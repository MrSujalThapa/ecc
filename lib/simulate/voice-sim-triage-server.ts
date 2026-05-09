/**
 * Server-only: runs the same triage stack as `/api/call/turn` final-turn path.
 * Do not import from client components — use `POST /api/dev/triage-preview` instead.
 */

import type { TriageAgentOutput } from "@/lib/ai/schemas/triageAgentOutputSchema";
import { runCallTriageAgent } from "@/lib/ai/agents/callTriageAgent";
import type { CallSession, Incident } from "@/lib/types/domain";
import type { AppMode } from "@/lib/types/enums";

export type VoiceSimTriagePreviewInput = {
  incident: Incident;
  call_session: CallSession;
  latest_transcript: string;
  transcript_history?: string[];
  mode?: AppMode;
  provider?: string | null;
};

export const runVoiceSimTriagePreview = async (
  input: VoiceSimTriagePreviewInput
): Promise<TriageAgentOutput> => {
  const mode = input.mode ?? input.incident.mode;
  return runCallTriageAgent({
    incident: input.incident,
    callSession: input.call_session,
    latestTranscript: input.latest_transcript,
    transcriptHistory: input.transcript_history ?? [],
    mode,
    provider: input.provider ?? process.env.AI_PROVIDER,
  });
};
