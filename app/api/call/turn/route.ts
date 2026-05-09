import { NextResponse } from "next/server";
import type { CallTurnResponse } from "@/lib/types/api";
import { jsonError, repositoryErrorResponse, zodToMessage } from "@/lib/server/api-route-helpers";
import { repositoryCallTurn } from "@/lib/db/call-repository";
import { callTurnRequestSchema } from "@/lib/validation/api-requests";

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
    const result = await repositoryCallTurn(parsed.data);
    const payload: CallTurnResponse = {
      say_to_caller: result.say_to_caller,
      incident: result.incident,
      call_session: result.call_session,
      transcript_event: result.transcript_event,
      actions: result.actions,
      triage_trace: result.triage_trace,
    };
    return NextResponse.json(payload);
  } catch (e) {
    const mapped = repositoryErrorResponse(e);
    if (mapped) return mapped;
    const msg = e instanceof Error ? e.message : "call_turn failed";
    return jsonError(msg, 500);
  }
};
