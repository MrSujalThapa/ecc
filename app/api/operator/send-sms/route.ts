/**
 * POST /api/operator/send-sms
 *
 * Sends a short factual SMS confirmation to a caller.
 * Accepts an optional `to` field (E.164 phone number) in addition to the
 * standard operatorSendSmsRequest fields.
 *
 * When Twilio is configured (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN +
 * TWILIO_PHONE_NUMBER), sends a real SMS via Twilio REST API.
 * When not configured, returns { sent: false } (stub) so the dashboard
 * can display stub state honestly without throwing.
 */

import { NextResponse } from "next/server";
import type { OperatorSendSmsResponse } from "@/lib/types/api";
import {
  jsonError,
  repositoryErrorResponse,
  zodToMessage,
} from "@/lib/server/api-route-helpers";
import { repositoryOperatorSendSms } from "@/lib/db/call-repository";
import { operatorSendSmsRequestSchema } from "@/lib/validation/api-requests";
import { sendSms } from "@/lib/voice/smsClient";
import { z } from "zod";

// Accept the standard fields plus an optional recipient phone number
const sendSmsRouteSchema = z.object({
  incident_id: z.string().min(1),
  operator_id: z.string().min(1),
  message: z.string().min(1),
  to: z.string().optional().nullable(),
});

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = sendSmsRouteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodToMessage(parsed.error), 400);
  }

  // Validate using the base schema as well (ensures backward compatibility)
  const baseParsed = operatorSendSmsRequestSchema.safeParse(body);
  if (!baseParsed.success) {
    return jsonError(zodToMessage(baseParsed.error), 400);
  }

  // 1. Run the repository function -- writes audit log, validates incident exists
  let basePayload: OperatorSendSmsResponse;
  try {
    basePayload = await repositoryOperatorSendSms(baseParsed.data);
  } catch (e) {
    const mapped = repositoryErrorResponse(e);
    if (mapped) return mapped;
    const msg = e instanceof Error ? e.message : "send_sms failed";
    return jsonError(msg, 500);
  }

  // 2. If a recipient number was provided, attempt real SMS via Twilio
  const to = parsed.data.to?.trim() ?? null;

  if (to) {
    const smsResult = await sendSms(to, parsed.data.message);

    if (smsResult.error) {
      console.error("[send-sms] SMS error:", smsResult.error);
    }

    const payload: OperatorSendSmsResponse = {
      incident_id: basePayload.incident_id,
      sent: smsResult.sent,
      ...(smsResult.provider_message_id
        ? { provider_message_id: smsResult.provider_message_id }
        : {}),
    };

    return NextResponse.json(payload);
  }

  // No recipient -- return stub (demo mode)
  console.info(
    "[send-sms] No 'to' number -- audit log written, SMS skipped. incident=" + parsed.data.incident_id
  );
  return NextResponse.json(basePayload);
};
