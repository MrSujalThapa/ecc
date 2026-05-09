import { NextResponse } from "next/server";
import type { OperatorResolveResponse } from "@/lib/types/api";
import { jsonError, repositoryErrorResponse, zodToMessage } from "@/lib/server/api-route-helpers";
import { repositoryOperatorResolve } from "@/lib/db/call-repository";
import { operatorResolveRequestSchema } from "@/lib/validation/api-requests";

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = operatorResolveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodToMessage(parsed.error), 400);
  }

  try {
    const result = await repositoryOperatorResolve(parsed.data);
    const payload: OperatorResolveResponse = {
      incident: result.incident,
      call_session: result.call_session,
    };
    return NextResponse.json(payload);
  } catch (e) {
    const mapped = repositoryErrorResponse(e);
    if (mapped) return mapped;
    const msg = e instanceof Error ? e.message : "resolve failed";
    return jsonError(msg, 500);
  }
};
