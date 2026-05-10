import { NextResponse } from "next/server";
import type { CallStartResponse } from "@/lib/types/api";
import { jsonError, zodToMessage } from "@/lib/server/api-route-helpers";
import { repositoryCallStart } from "@/lib/db/call-repository";
import { resolveCallerPhoneJsonOrTwilio } from "@/lib/voice/callerPhoneResolution";
import { callStartRequestSchema } from "@/lib/validation/api-requests";

export const POST = async (request: Request): Promise<NextResponse> => {
  const contentType = request.headers.get("content-type") ?? "(none)";
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
    const explicitPhone = parsed.data.caller_phone?.trim() || null;
    const resolvedPhone =
      explicitPhone ??
      (await resolveCallerPhoneJsonOrTwilio({
        rawJson: body,
        twilioCallSid: parsed.data.twilio_call_sid ?? null,
      }));

    console.info(
      `[call/start] content-type=${contentType} twilio_call_sid=${parsed.data.twilio_call_sid ?? "null"} ` +
        `elevenlabs_conversation_id=${parsed.data.elevenlabs_conversation_id ?? "null"} ` +
        `caller_phone→repositoryCallStart=${resolvedPhone ?? "null"}`
    );

    const result = await repositoryCallStart({
      ...parsed.data,
      caller_phone: resolvedPhone,
    });
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
