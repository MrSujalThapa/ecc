import { NextResponse } from "next/server";
import { repositorySurgeAnalyze } from "@/lib/db/call-repository";
import {
  jsonError,
  repositoryErrorResponse,
  zodToMessage,
} from "@/lib/server/api-route-helpers";
import { surgeAnalyzeRequestSchema } from "@/lib/validation/api-requests";

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = surgeAnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodToMessage(parsed.error), 400);
  }

  try {
    const result = await repositorySurgeAnalyze(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const mapped = repositoryErrorResponse(error);
    if (mapped) return mapped;
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "surge analysis failed";
    return jsonError(message, 500);
  }
};
