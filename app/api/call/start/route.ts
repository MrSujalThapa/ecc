import { NextResponse } from "next/server";
import type { CallStartResponse } from "@/lib/types/api";
import { jsonError, zodToMessage } from "@/lib/server/api-route-helpers";
import { repositoryCallStart } from "@/lib/db/call-repository";
import { callStartRequestSchema } from "@/lib/validation/api-requests";

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim() !== "") {
      body = JSON.parse(text) as unknown;
    }
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = callStartRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodToMessage(parsed.error), 400);
  }

  try {
    const result = await repositoryCallStart(parsed.data);
    const payload: CallStartResponse = {
      incident_id: result.incident_id,
      call_session_id: result.call_session_id,
      incident: result.incident,
      call_session: result.call_session,
    };
    return NextResponse.json(payload, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "call_start failed";
    return jsonError(msg, 500);
  }
};
