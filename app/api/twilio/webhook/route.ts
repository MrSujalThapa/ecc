/**
 * POST /api/twilio/webhook
 *
 * Receives inbound call events from Twilio.
 * Twilio sends application/x-www-form-urlencoded — not JSON.
 *
 * Flow:
 *   1. Parse Twilio form body
 *   2. Determine call mode (normal / disaster / world_cup via query param)
 *   3. Call repositoryCallStart to create Incident + CallSession
 *   4. Register the session in voiceSessionStore
 *   5. Optionally create an ElevenLabs signed conversation URL
 *   6. Return TwiML that connects the call to ElevenLabs
 *
 * Fallback: if ElevenLabs is not configured, speaks a holding message and hangs up.
 *
 * Security: Twilio signature validation is recommended for production.
 * For the hackathon demo, it is skipped to simplify local tunnel setup.
 * Enable it by verifying the X-Twilio-Signature header when ready.
 */

import { NextResponse } from "next/server";
import { repositoryCallStart } from "@/lib/db/call-repository";
import type { AppMode } from "@/lib/types/enums";
import {
  buildTwimlConnectElevenLabs,
  buildTwimlSayAndHangup,
  createElevenLabsConversation,
  parseTwilioFormBody,
  registerElevenLabsTwilioCall,
} from "@/lib/voice/twilioClient";
import { elevenLabsConfig } from "@/lib/voice/voiceConfig";
import {
  registerVoiceSession,
  updateVoiceSessionElevenLabsId,
} from "@/lib/voice/voiceSessionStore";

export const POST = async (request: Request): Promise<NextResponse> => {
  const contentType = request.headers.get("content-type") ?? "(none)";
  // 1. Parse Twilio's form-encoded body
  const body = await parseTwilioFormBody(request);
  const callSid = body.CallSid ?? "";
  const callStatus = body.CallStatus ?? "";
  const fromNumber = body.From ?? "";
  const toNumber = body.To ?? "";
  const callerPhone =
    body.From?.trim() ||
    body.from?.trim() ||
    body.Caller?.trim() ||
    body.caller?.trim() ||
    null;

  console.info(
    `[twilio/webhook] content-type=${contentType} inbound CallSid=${callSid || "null"} ` +
      `CallStatus=${callStatus} From=${callerPhone ?? "(missing)"} ` +
      `form_keys=${Object.keys(body).sort().join(",")} caller_phone→repositoryCallStart=${callerPhone ?? "null"}`
  );

  // Only process new inbound calls
  if (!callSid) {
    return new NextResponse(
      buildTwimlSayAndHangup("Sorry, we could not process your call right now."),
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  }

  // 2. Determine mode from query param (default: normal)
  const { searchParams } = new URL(request.url);
  const rawMode = searchParams.get("mode") ?? "normal";
  const mode: AppMode =
    rawMode === "disaster" || rawMode === "world_cup" ? rawMode : "normal";

  // 3. Create backend Incident + CallSession
  let incidentId: string;
  let callSessionId: string;

  try {
    const started = await repositoryCallStart({
      mode,
      twilio_call_sid: callSid,
      elevenlabs_conversation_id: null,
      caller_phone: callerPhone,
    });
    incidentId = started.incident_id;
    callSessionId = started.call_session_id;

    console.info(
      `[twilio/webhook] Created incident=${incidentId} session=${callSessionId}`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "call_start failed";
    console.error("[twilio/webhook] repositoryCallStart error:", msg);
    return new NextResponse(
      buildTwimlSayAndHangup(
        "We are experiencing technical difficulties. Please try again shortly."
      ),
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  }

  // 4. Register the session in voice store (maps callSid → incident/session IDs)
  registerVoiceSession({
    twilio_call_sid: callSid,
    incident_id: incidentId,
    call_session_id: callSessionId,
    mode,
  });

  // 5. If ElevenLabs is configured, try to get a signed conversation URL
  //    This lets us pass incident_id + call_session_id as context to the agent.
  let twiml: string;

  if (elevenLabsConfig.isConfigured) {
    // Use register-call — ElevenLabs returns ready-to-use TwiML with the correct
    // stream URL and a conversation_id we can use for session tracking.
    const registered = await registerElevenLabsTwilioCall({ callSid, fromNumber, toNumber });

    if (registered) {
      twiml = registered.twiml;
      if (registered.conversationId) {
        updateVoiceSessionElevenLabsId(callSid, registered.conversationId);
        console.info(`[twilio/webhook] ElevenLabs conv_id=${registered.conversationId}`);
      }
      console.info("[twilio/webhook] register-call OK — using ElevenLabs TwiML");
    } else {
      // Fallback if register-call fails (key missing convai_write, etc.)
      const conv = await createElevenLabsConversation({
        incident_id: incidentId,
        call_session_id: callSessionId,
        mode,
      });
      if (conv?.conversation_id) {
        updateVoiceSessionElevenLabsId(callSid, conv.conversation_id);
      }
      twiml = buildTwimlConnectElevenLabs({
        signedUrl: conv?.signed_url ?? null,
        incidentId: incidentId,
        callSessionId: callSessionId,
      });
      console.warn("[twilio/webhook] register-call failed — using fallback TwiML");
    }

    console.info(`[twilio/webhook] TwiML: ${twiml}`);
  } else {
    // ElevenLabs not configured — give a holding message for demo safety
    console.warn(
      "[twilio/webhook] ElevenLabs not configured. Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID."
    );
    twiml = buildTwimlSayAndHangup(
      "Thank you for calling. An operator will be with you shortly."
    );
  }

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
};
