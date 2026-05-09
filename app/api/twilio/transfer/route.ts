/**
 * POST /api/twilio/transfer
 *
 * Triggers an emergency call transfer to the operator phone number.
 * Called internally by the ElevenLabs webhook handler when the backend
 * returns a "transfer_to_operator" system action.
 *
 * Request body (JSON):
 *   { twilio_call_sid: string, incident_id: string, call_session_id: string }
 *
 * Flow:
 *   1. Look up the operator forward number from config
 *   2. Redirect the live Twilio call to the operator's phone via Twilio REST API
 *   3. Call /api/call/end with reason="transferred"
 *   4. Update the incident to human_active via /api/operator/takeover
 *
 * Security: This endpoint should only be called by server-side code (ElevenLabs
 * webhook handler). Add authentication if exposing externally.
 */

import { NextResponse } from "next/server";
import { repositoryCallEnd, repositoryOperatorTakeover } from "@/lib/db/call-repository";
import {
  buildTwimlTransfer,
  redirectTwilioCall,
} from "@/lib/voice/twilioClient";
import { twilioConfig } from "@/lib/voice/voiceConfig";
import { removeVoiceSession } from "@/lib/voice/voiceSessionStore";
import { z } from "zod";

const transferRequestSchema = z.object({
  twilio_call_sid: z.string().min(1),
  incident_id: z.string().min(1),
  call_session_id: z.string().min(1),
  /** Optional operator ID for audit log. Defaults to "operator_transfer". */
  operator_id: z.string().optional(),
});

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = transferRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { twilio_call_sid, incident_id, call_session_id, operator_id } = parsed.data;
  const operatorId = operator_id ?? "operator_transfer";

  const operatorNumber = twilioConfig.operatorForwardNumber;
  if (!operatorNumber) {
    console.error(
      "[twilio/transfer] TWILIO_OPERATOR_FORWARD_NUMBER not set. Cannot transfer call."
    );
    return NextResponse.json(
      { ok: false, error: "Operator forward number not configured" },
      { status: 500 }
    );
  }

  // 1. Redirect the live Twilio call to the operator phone
  const twiml = buildTwimlTransfer(operatorNumber);
  let transferOk = false;

  if (twilioConfig.isConfigured) {
    const redirectResult = await redirectTwilioCall(twilio_call_sid, twiml);
    transferOk = redirectResult.ok;
    if (!redirectResult.ok) {
      console.error(
        `[twilio/transfer] Redirect failed for CallSid=${twilio_call_sid}:`,
        redirectResult.error
      );
    } else {
      console.info(
        `[twilio/transfer] Redirected CallSid=${twilio_call_sid} → ${operatorNumber}`
      );
    }
  } else {
    console.warn(
      "[twilio/transfer] Twilio not configured — skipping live call redirect (stub mode)."
    );
    transferOk = true; // Allow state updates to proceed in stub mode
  }

  // 2. Mark incident as human_active via operator takeover
  try {
    await repositoryOperatorTakeover({
      incident_id,
      operator_id: operatorId,
    });
    console.info(
      `[twilio/transfer] Operator takeover recorded. incident=${incident_id}`
    );
  } catch (e) {
    console.error("[twilio/transfer] Takeover error:", e);
  }

  // 3. Close the call session with reason=transferred
  try {
    await repositoryCallEnd({
      incident_id,
      call_session_id,
      reason: "transferred",
    });
  } catch (e) {
    console.error("[twilio/transfer] Call end error:", e);
  }

  // 4. Clean up voice session store
  removeVoiceSession(twilio_call_sid);

  return NextResponse.json({
    ok: true,
    transfer_initiated: transferOk,
    operator_number: operatorNumber,
  });
};
