import { NextResponse } from "next/server";
import type {
  OperatorUpdateIncidentRequest,
  OperatorUpdateIncidentResponse,
} from "@/lib/types/api";
import { jsonError, repositoryErrorResponse, zodToMessage } from "@/lib/server/api-route-helpers";
import { repositoryOperatorUpdateIncident } from "@/lib/db/call-repository";
import { operatorUpdateIncidentRequestSchema } from "@/lib/validation/api-requests";

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = operatorUpdateIncidentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodToMessage(parsed.error), 400);
  }

  try {
    const result = await repositoryOperatorUpdateIncident({
      incident_id: parsed.data.incident_id,
      operator_id: parsed.data.operator_id,
      patch: parsed.data.patch as OperatorUpdateIncidentRequest["patch"],
    });
    const payload: OperatorUpdateIncidentResponse = { incident: result.incident };
    return NextResponse.json(payload);
  } catch (e) {
    const mapped = repositoryErrorResponse(e);
    if (mapped) return mapped;
    const msg = e instanceof Error ? e.message : "update_incident failed";
    return jsonError(msg, 500);
  }
};
