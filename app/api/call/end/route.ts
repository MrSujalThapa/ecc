import { NextResponse } from "next/server";
import type { CallEndResponse } from "@/lib/types/api";
import { jsonError, repositoryErrorResponse, zodToMessage } from "@/lib/server/api-route-helpers";
import { repositoryCallEnd } from "@/lib/db/call-repository";
import { callEndRequestSchema } from "@/lib/validation/api-requests";

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = callEndRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodToMessage(parsed.error), 400);
  }

  try {
    const result = await repositoryCallEnd({
      incident_id: parsed.data.incident_id,
      call_session_id: parsed.data.call_session_id,
      reason: parsed.data.reason,
      outcome: parsed.data.outcome,
    });
    const payload: CallEndResponse = {
      incident: result.incident,
      call_session: result.call_session,
    };
    return NextResponse.json(payload);
  } catch (e) {
    const mapped = repositoryErrorResponse(e);
    if (mapped) return mapped;
    const msg = e instanceof Error ? e.message : "call_end failed";
    return jsonError(msg, 500);
  }
};
