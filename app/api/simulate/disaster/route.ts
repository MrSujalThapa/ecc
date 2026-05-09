import { NextResponse } from "next/server";
import type { SimulateDisasterResponse } from "@/lib/types/api";
import { jsonError, zodToMessage } from "@/lib/server/api-route-helpers";
import { repositorySimulateDisaster } from "@/lib/db/call-repository";
import { simulateBatchRequestSchema } from "@/lib/validation/api-requests";

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

  const parsed = simulateBatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodToMessage(parsed.error), 400);
  }

  try {
    const payload: SimulateDisasterResponse = await repositorySimulateDisaster({
      batch_size: parsed.data.batch_size,
      offset: parsed.data.offset,
      maxCap: 29,
      reset_existing: parsed.data.reset_existing,
    });
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "simulate failed";
    return jsonError(msg, 500);
  }
};
