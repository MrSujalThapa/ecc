import { NextResponse } from "next/server";
import type { TriageAgentOutput } from "@/lib/ai/schemas/triageAgentOutputSchema";
import { jsonError, zodToMessage } from "@/lib/server/api-route-helpers";
import { runVoiceSimTriagePreview } from "@/lib/simulate/voice-sim-triage-server";
import type { CallSession, Incident } from "@/lib/types/domain";
import { triagePreviewRequestSchema } from "@/lib/validation/api-requests";

export type TriagePreviewResponse = {
  triage: TriageAgentOutput;
};

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = triagePreviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodToMessage(parsed.error), 400);
  }

  const { incident: i, call_session: s, latest_transcript, transcript_history, mode, provider } =
    parsed.data;

  try {
    const triage = await runVoiceSimTriagePreview({
      incident: i as Incident,
      call_session: s as CallSession,
      latest_transcript: latest_transcript.trim(),
      transcript_history,
      mode,
      provider,
    });
    const payload: TriagePreviewResponse = { triage };
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "triage_preview failed";
    return jsonError(msg, 500);
  }
};
