/**
 * POST /api/operator/send-sms
 *
 * Sends a short factual SMS confirmation to a caller.
 * Body: incident_id, operator_id, message, optional `to` (E.164).
 * When `to` is omitted, recipient is the latest `call_sessions.caller_phone`
 * for the incident (populated from Twilio inbound `From` on call start).
 *
 * When Twilio is configured (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN +
 * TWILIO_PHONE_NUMBER), sends a real SMS via Twilio REST API.
 */

import { NextResponse } from "next/server";
import type { OperatorSendSmsResponse } from "@/lib/types/api";
import {
  jsonError,
  repositoryErrorResponse,
  zodToMessage,
} from "@/lib/server/api-route-helpers";
import {
  repositoryLatestCallerPhoneForIncident,
  repositoryOperatorSendSms,
} from "@/lib/db/call-repository";
import { operatorSendSmsRequestSchema } from "@/lib/validation/api-requests";
import { sendSms } from "@/lib/voice/smsClient";

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = operatorSendSmsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodToMessage(parsed.error), 400);
  }

  let basePayload: OperatorSendSmsResponse;
  try {
    basePayload = await repositoryOperatorSendSms(parsed.data);
  } catch (e) {
    const mapped = repositoryErrorResponse(e);
    if (mapped) return mapped;
    const msg = e instanceof Error ? e.message : "send_sms failed";
    return jsonError(msg, 500);
  }

  const explicitTo = parsed.data.to?.trim() ?? null;
  let recipient: string | null =
    explicitTo && explicitTo.length > 0 ? explicitTo : null;

  if (!recipient) {
    try {
      recipient = await repositoryLatestCallerPhoneForIncident(
        parsed.data.incident_id
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "caller_phone lookup failed";
      return jsonError(msg, 500);
    }
  }

  if (!recipient) {
    const payload: OperatorSendSmsResponse = {
      incident_id: basePayload.incident_id,
      sent: false,
      error: "No recipient phone number found for this incident.",
    };
    return NextResponse.json(payload);
  }

  const smsResult = await sendSms(recipient, parsed.data.message);

  if (smsResult.error) {
    console.error("[send-sms] SMS error:", smsResult.error);
  }

  const payload: OperatorSendSmsResponse = {
    incident_id: basePayload.incident_id,
    sent: smsResult.sent,
    ...(smsResult.provider_message_id
      ? { provider_message_id: smsResult.provider_message_id }
      : {}),
    ...(!smsResult.sent && smsResult.error ? { error: smsResult.error } : {}),
  };

  return NextResponse.json(payload);
};
