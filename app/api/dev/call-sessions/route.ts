import { NextResponse } from "next/server";
import { repositoryListCallSessionsForDev } from "@/lib/db/call-repository";
import { jsonError } from "@/lib/server/api-route-helpers";
import type { CallSession } from "@/lib/types/domain";

export type DevCallSessionsResponse = {
  call_sessions: CallSession[];
};

export const GET = async (request: Request): Promise<NextResponse> => {
  const { searchParams } = new URL(request.url);
  const incident_id = searchParams.get("incident_id")?.trim();
  if (!incident_id) {
    return jsonError("Missing incident_id query parameter", 400);
  }

  try {
    const call_sessions = await repositoryListCallSessionsForDev(incident_id);
    const payload: DevCallSessionsResponse = { call_sessions };
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "list call_sessions failed";
    return jsonError(msg, 500);
  }
};
