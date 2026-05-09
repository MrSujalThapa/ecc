import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export const jsonError = (message: string, status: number): NextResponse => {
  return NextResponse.json({ error: message }, { status });
};

export const zodToMessage = (err: ZodError): string =>
  err.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`).join("; ");

/** Map errors thrown by `lib/db/call-repository` to HTTP responses. */
export const repositoryErrorResponse = (error: unknown): NextResponse | null => {
  const m = error instanceof Error ? error.message : "";
  if (m === "NOT_FOUND") {
    return jsonError("incident_id or call_session_id not found", 404);
  }
  if (m === "SESSION_MISMATCH") {
    return jsonError("call_session does not belong to incident", 400);
  }
  if (m === "SESSION_INACTIVE") {
    return jsonError("call_session is not active", 409);
  }
  if (m === "SESSION_MISSING") {
    return jsonError("call_session missing after transcript write", 500);
  }
  return null;
};
