import { NextResponse } from "next/server";
import type { SurgeAnalyzeResponse } from "@/lib/types/api";
import { jsonError, zodToMessage } from "@/lib/server/api-route-helpers";
import { repositorySurgeAnalyze } from "@/lib/db/call-repository";
import { surgeAnalyzeRequestSchema } from "@/lib/validation/api-requests";

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

  const parsed = surgeAnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodToMessage(parsed.error), 400);
  }

  try {
    const payload: SurgeAnalyzeResponse = await repositorySurgeAnalyze(parsed.data);
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "surge analyze failed";
    return jsonError(msg, 500);
  }
};
