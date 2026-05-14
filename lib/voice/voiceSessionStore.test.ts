import { afterEach, describe, expect, it } from "vitest";
import {
  getSessionByElevenLabsId,
  getSessionByTwilioSid,
  patchVoiceSessionCallerPhone,
  registerVoiceSession,
  removeVoiceSession,
} from "./voiceSessionStore";

const cleanupKeys = new Set<string>();

const trackKey = (key: string): string => {
  cleanupKeys.add(key);
  return key;
};

afterEach(() => {
  for (const key of cleanupKeys) {
    removeVoiceSession(key);
  }
  cleanupKeys.clear();
});

describe("voiceSessionStore caller_phone lifecycle", () => {
  it("stores caller_phone on register", () => {
    const sid = trackKey(`CA-store-${Date.now()}`);
    registerVoiceSession({
      twilio_call_sid: sid,
      incident_id: "incident-store",
      call_session_id: "session-store",
      caller_phone: " +14155550123 ",
    });

    expect(getSessionByTwilioSid(sid)?.caller_phone).toBe("+14155550123");
  });

  it("fills missing caller_phone via patch helper", () => {
    const sid = trackKey(`CA-fill-${Date.now()}`);
    registerVoiceSession({
      twilio_call_sid: sid,
      incident_id: "incident-fill",
      call_session_id: "session-fill",
    });

    patchVoiceSessionCallerPhone(sid, " +14155550456 ");

    expect(getSessionByTwilioSid(sid)?.caller_phone).toBe("+14155550456");
  });

  it("does not overwrite a known caller_phone with null or blank", () => {
    const sid = trackKey(`CA-preserve-${Date.now()}`);
    registerVoiceSession({
      twilio_call_sid: sid,
      incident_id: "incident-preserve",
      call_session_id: "session-preserve",
      caller_phone: "+14155550789",
    });

    patchVoiceSessionCallerPhone(sid, null);
    patchVoiceSessionCallerPhone(sid, "   ");
    patchVoiceSessionCallerPhone(sid, "+14155550000");

    expect(getSessionByTwilioSid(sid)?.caller_phone).toBe("+14155550789");
  });

  it("preserves caller_phone across elevenlabs lookup aliases", () => {
    const sid = trackKey(`CA-alias-${Date.now()}`);
    const conversationId = `conv-alias-${Date.now()}`;
    registerVoiceSession({
      twilio_call_sid: sid,
      incident_id: "incident-alias",
      call_session_id: "session-alias",
      elevenlabs_conversation_id: conversationId,
    });

    patchVoiceSessionCallerPhone(conversationId, "+14155550999");

    expect(getSessionByTwilioSid(sid)?.caller_phone).toBe("+14155550999");
    expect(getSessionByElevenLabsId(conversationId)?.caller_phone).toBe(
      "+14155550999"
    );
  });
});
