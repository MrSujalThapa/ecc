import { NextResponse } from "next/server";
import type { OperatorTakeoverResponse } from "@/lib/types/api";
import { jsonError, repositoryErrorResponse, zodToMessage } from "@/lib/server/api-route-helpers";
import { repositoryOperatorTakeover } from "@/lib/db/call-repository";
import { operatorTakeoverRequestSchema } from "@/lib/validation/api-requests";

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = operatorTakeoverRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodToMessage(parsed.error), 400);
  }

  try {
    const result = await repositoryOperatorTakeover(parsed.data);
    const payload: OperatorTakeoverResponse = {
      incident: result.incident,
      call_session: result.call_session,
      transfer_status: result.transfer_status,
    };
    return NextResponse.json(payload);
  } catch (e) {
    const mapped = repositoryErrorResponse(e);
    if (mapped) return mapped;
    const msg = e instanceof Error ? e.message : "takeover failed";
    return jsonError(msg, 500);
  }
};
