/**
 * POST /api/twilio/status
 *
 * Receives Twilio call status callback events (statusCallback URL).
 * Configure this URL in your Twilio phone number settings or TwiML as:
 *   statusCallback="https://your-domain.com/api/twilio/status"
 *   statusCallbackMethod="POST"
 *
 * When the call reaches a terminal status (completed, failed, busy, no-answer,
 * canceled), this handler closes the backend CallSession via /api/call/end.
 *
 * Twilio sends application/x-www-form-urlencoded.
 */

import { NextResponse } from "next/server";
import { repositoryCallEnd } from "@/lib/db/call-repository";
import {
  getSessionByTwilioSid,
  removeVoiceSession,
} from "@/lib/voice/voiceSessionStore";
import {
  isTwilioCallTerminal,
  type TwilioCallStatus,
} from "@/lib/voice/twilioTypes";
import { parseTwilioFormBody } from "@/lib/voice/twilioClient";

export const POST = async (request: Request): Promise<NextResponse> => {
  const body = await parseTwilioFormBody(request);
  const callSid = body.CallSid ?? "";
  const callStatus = (body.CallStatus ?? "") as TwilioCallStatus;
  const duration = body.CallDuration ?? null;

  console.info(
    `[twilio/status] CallSid=${callSid} Status=${callStatus} Duration=${duration ?? "n/a"}s`
  );

  if (!callSid) {
    return NextResponse.json({ ok: true, note: "no CallSid" });
  }

  // Only act on terminal statuses
  if (!isTwilioCallTerminal(callStatus)) {
    return NextResponse.json({ ok: true, note: `non-terminal status: ${callStatus}` });
  }

  // Look up the backend session IDs
  const entry = getSessionByTwilioSid(callSid);
  if (!entry) {
    console.warn(
      `[twilio/status] No voice session found for CallSid=${callSid}. May have already been cleaned up.`
    );
    return NextResponse.json({ ok: true, note: "session not found" });
  }

  // Map Twilio status to our call-end reason
  const reason =
    callStatus === "completed"
      ? "completed"
      : callStatus === "busy" || callStatus === "no-answer"
        ? "abandoned"
        : "abandoned";

  try {
    await repositoryCallEnd({
      incident_id: entry.incident_id,
      call_session_id: entry.call_session_id,
      reason,
    });

    console.info(
      `[twilio/status] Closed session. incident=${entry.incident_id} reason=${reason}`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "call_end failed";
    // Log but don't fail — Twilio retries on non-2xx
    console.error("[twilio/status] repositoryCallEnd error:", msg);
  }

  // Clean up voice session store
  removeVoiceSession(callSid);

  return NextResponse.json({ ok: true });
};
