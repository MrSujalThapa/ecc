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
 *   1. Load incident mode; pick operator E.164 via resolveOperatorForwardE164
 *   2. Mark call_session.operator_transfer_status = transferring + audit
 *   3. Redirect the live Twilio call via Twilio REST API
 *   4. On failure: mark transfer failed, roll back incident if needed, audit
 *   5. On success: operator takeover, call end, transfer_completed audit
 *
 * Security: This endpoint should only be called by server-side code (ElevenLabs
 * webhook handler). Add authentication if exposing externally.
 */

import { NextResponse } from "next/server";
import {
  repositoryCallEnd,
  repositoryLogTransferCompleted,
  repositoryMarkTransferBridging,
  repositoryMarkTransferFailed,
  repositoryOperatorTakeover,
} from "@/lib/db/call-repository";
import { mapIncidentRow } from "@/lib/db/mappers";
import {
  buildTwimlTransfer,
  redirectTwilioCall,
} from "@/lib/voice/twilioClient";
import { resolveOperatorForwardE164, twilioConfig } from "@/lib/voice/voiceConfig";
import { removeVoiceSession } from "@/lib/voice/voiceSessionStore";
import { getServiceRoleClient } from "@/lib/supabase/service";
import type { AppMode } from "@/lib/types/enums";
import { z } from "zod";

const transferRequestSchema = z.object({
  twilio_call_sid: z.string().min(1),
  incident_id: z.string().min(1),
  call_session_id: z.string().min(1),
  /** Optional operator ID for audit log. Defaults to "operator_transfer". */
  operator_id: z.string().optional(),
});

const loadIncidentMode = async (incident_id: string): Promise<AppMode> => {
  const client = getServiceRoleClient();
  if (!client) return "normal";
  const { data, error } = await client
    .from("incidents")
    .select("*")
    .eq("id", incident_id)
    .single();
  if (error || !data) return "normal";
  return mapIncidentRow(data as Record<string, unknown>).mode;
};

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

  const mode = await loadIncidentMode(incident_id);
  const operatorNumber = resolveOperatorForwardE164(mode);
  if (!operatorNumber) {
    console.error(
      "[twilio/transfer] No operator forward number configured (primary or ALT for this mode)."
    );
    return NextResponse.json(
      { ok: false, error: "Operator forward number not configured" },
      { status: 500 }
    );
  }

  try {
    await repositoryMarkTransferBridging({ incident_id, call_session_id });
  } catch (e) {
    console.error("[twilio/transfer] Bridging state error:", e);
  }

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
    transferOk = true;
  }

  if (!transferOk) {
    try {
      await repositoryMarkTransferFailed({
        incident_id,
        call_session_id,
        error_message: "twilio_redirect_failed",
      });
    } catch (e) {
      console.error("[twilio/transfer] Mark transfer failed error:", e);
    }
    return NextResponse.json({
      ok: false,
      transfer_initiated: false,
      operator_number: operatorNumber,
      error: "Twilio redirect failed",
    });
  }

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

  try {
    await repositoryCallEnd({
      incident_id,
      call_session_id,
      reason: "transferred",
    });
  } catch (e) {
    console.error("[twilio/transfer] Call end error:", e);
  }

  try {
    await repositoryLogTransferCompleted({ incident_id, call_session_id });
  } catch (e) {
    console.error("[twilio/transfer] transfer_completed audit error:", e);
  }

  removeVoiceSession(twilio_call_sid);

  return NextResponse.json({
    ok: true,
    transfer_initiated: transferOk,
    operator_number: operatorNumber,
  });
};
