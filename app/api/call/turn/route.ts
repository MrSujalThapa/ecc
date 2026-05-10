import { NextResponse } from "next/server";
import type { CallTurnResponse } from "@/lib/types/api";
import { jsonError, repositoryErrorResponse, zodToMessage } from "@/lib/server/api-route-helpers";
import { repositoryCallTurn } from "@/lib/db/call-repository";
import { callTurnRequestSchema } from "@/lib/validation/api-requests";

const voiceDebugEnabled = (): boolean => process.env.ECC_VOICE_DEBUG === "true";

const shortText = (value: unknown, maxLength = 140): string | null => {
  if (typeof value !== "string") return null;
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength
    ? `${compact.slice(0, maxLength)}...`
    : compact;
};

const summarizeKeys = (value: unknown): string[] =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>).sort()
    : [];

const voiceDebug = (
  stage: "before-ai" | "after-merge",
  payload: Record<string, unknown>
): void => {
  if (!voiceDebugEnabled()) return;
  console.info(`[ECC Voice Debug] ${stage}`, payload);
};

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = callTurnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodToMessage(parsed.error), 400);
  }

  try {
    voiceDebug("before-ai", {
      route: "/api/call/turn",
      incident_id: parsed.data.incident_id,
      call_session_id: parsed.data.call_session_id,
      latestTranscript: shortText(parsed.data.text ?? parsed.data.final_transcript),
      is_final: parsed.data.is_final,
      source: parsed.data.source ?? null,
    });

    const result = await repositoryCallTurn(parsed.data);
    const payload: CallTurnResponse = {
      say_to_caller: result.say_to_caller,
      incident: result.incident,
      call_session: result.call_session,
      transcript_event: result.transcript_event,
      actions: result.actions,
      triage_trace: result.triage_trace,
    };

    voiceDebug("after-merge", {
      route: "/api/call/turn",
      incident_id: result.incident.id,
      public_id: result.incident.public_id,
      call_session_id: result.call_session.id,
      say_to_caller: shortText(result.say_to_caller),
      incident_type: result.incident.incident_type,
      urgency: result.incident.urgency,
      location: shortText(result.incident.location, 100),
      collected_fields_keys: summarizeKeys(result.incident.collected_fields),
      missing_fields: result.incident.missing_fields,
      next_question: shortText(result.call_session.next_question),
      should_escalate: result.call_session.should_escalate,
      system_actions: result.actions.map((action) => action.action),
      provider: result.triage_trace?.pass2_provider ?? result.triage_trace?.pass1_provider ?? null,
    });

    return NextResponse.json(payload);
  } catch (e) {
    const mapped = repositoryErrorResponse(e);
    if (mapped) return mapped;
    const msg = e instanceof Error ? e.message : "call_turn failed";
    return jsonError(msg, 500);
  }
};
