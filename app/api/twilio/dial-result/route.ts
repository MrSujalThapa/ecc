/**
 * POST /api/twilio/dial-result
 *
 * Twilio posts here when the <Dial> verb completes — i.e. when the operator
 * picks up, hangs up, is busy, or does not answer.
 *
 * Twilio form fields:
 *   CallSid          — original caller's call SID
 *   DialCallSid      — operator leg SID
 *   DialCallStatus   — answered | completed | busy | no-answer | failed | canceled
 *   DialCallDuration — seconds the operator was connected (when answered)
 *
 * Outcomes:
 *   answered / completed → "transferred": takeover, close session, remove from store
 *   busy / no-answer / failed / canceled → "failed": keep session open, reconnect to AI
 */

import { NextResponse } from "next/server";
import { repositoryCallEnd, repositoryOperatorTakeover } from "@/lib/db/call-repository";
import { parseTwilioFormBody, buildTwimlConnectElevenLabs, buildTwimlSayAndHangup } from "@/lib/voice/twilioClient";
import { elevenLabsConfig } from "@/lib/voice/voiceConfig";
import {
  getSessionByTwilioSid,
  removeVoiceSession,
} from "@/lib/voice/voiceSessionStore";
import { updateCallSessionTransferStatus } from "@/lib/voice/transferStatus";

type DialCallStatus =
  | "answered"
  | "completed"
  | "busy"
  | "no-answer"
  | "failed"
  | "canceled";

const OPERATOR_ANSWERED: DialCallStatus[] = ["answered", "completed"];

export const POST = async (request: Request): Promise<NextResponse | Response> => {
  const body = await parseTwilioFormBody(request);
  const callSid = body.CallSid ?? "";
  const dialStatus = (body.DialCallStatus ?? "") as DialCallStatus;
  const dialDuration = body.DialCallDuration ?? "0";

  console.info(
    `[twilio/dial-result] CallSid=${callSid} DialCallStatus=${dialStatus} Duration=${dialDuration}s`
  );

  if (!callSid) {
    return new NextResponse(buildTwimlSayAndHangup("Thank you for calling."), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const entry = getSessionByTwilioSid(callSid);
  if (!entry) {
    console.warn(`[twilio/dial-result] No session for CallSid=${callSid}`);
    return new NextResponse(buildTwimlSayAndHangup("Thank you for calling."), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const { incident_id, call_session_id } = entry;

  // -------------------------------------------------------------------------
  // Operator answered — transfer complete
  // -------------------------------------------------------------------------
  if (OPERATOR_ANSWERED.includes(dialStatus)) {
    console.info(
      `[twilio/dial-result] Operator answered — incident=${incident_id} duration=${dialDuration}s`
    );

    await updateCallSessionTransferStatus(call_session_id, "transferred").catch((e) =>
      console.error("[twilio/dial-result] Status update (transferred) error:", e)
    );

    try {
      await repositoryOperatorTakeover({ incident_id, operator_id: "operator_transfer" });
    } catch (e) {
      console.error("[twilio/dial-result] Takeover error:", e);
    }

    try {
      await repositoryCallEnd({ incident_id, call_session_id, reason: "transferred" });
    } catch (e) {
      console.error("[twilio/dial-result] Call end error:", e);
    }

    removeVoiceSession(callSid);

    // Caller and operator are already connected — Twilio will hang up this leg
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  }

  // -------------------------------------------------------------------------
  // Operator unavailable — keep caller with AI
  // -------------------------------------------------------------------------
  console.warn(
    `[twilio/dial-result] Operator unavailable (${dialStatus}) — reconnecting caller to AI. incident=${incident_id}`
  );

  await updateCallSessionTransferStatus(call_session_id, "failed").catch((e) =>
    console.error("[twilio/dial-result] Status update (failed) error:", e)
  );

  // Reconnect to ElevenLabs so the caller stays with the AI
  let reconnectTwiml: string;

  if (elevenLabsConfig.isConfigured) {
    // Embed incident/session context so the ElevenLabs webhook can resume the session
    reconnectTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">The operator is currently unavailable. Our AI assistant will continue to help you.</Say>
  <Connect>
    <Stream url="${`wss://api.elevenlabs.io/v1/convai/call?agent_id=${encodeURIComponent(elevenLabsConfig.agentId)}`}">
      <Parameter name="incident_id" value="${incident_id}" />
      <Parameter name="call_session_id" value="${call_session_id}" />
    </Stream>
  </Connect>
</Response>`;
  } else {
    reconnectTwiml = buildTwimlSayAndHangup(
      "The operator is currently unavailable. Please call back shortly. Thank you."
    );
  }

  return new NextResponse(reconnectTwiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
};
