import { NextResponse } from "next/server";
import { repositoryListIncidentsForDev } from "@/lib/db/call-repository";
import { jsonError } from "@/lib/server/api-route-helpers";
import type { Incident } from "@/lib/types/domain";

export type DevIncidentsResponse = {
  incidents: Incident[];
};

export const GET = async (request: Request): Promise<NextResponse> => {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("limit");
  const limit = raw ? Number.parseInt(raw, 10) : 50;
  if (Number.isNaN(limit) || limit < 1) {
    return jsonError("Invalid limit", 400);
  }

  try {
    const incidents = await repositoryListIncidentsForDev(limit);
    const payload: DevIncidentsResponse = { incidents };
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "list incidents failed";
    return jsonError(msg, 500);
  }
};
