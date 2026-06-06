import { afterEach, describe, expect, it } from "vitest";
import { resolveWebhookSession } from "@/app/api/elevenlabs/webhook/route";
import {
  repositoryCallStart,
  repositoryPersistElevenLabsConversationId,
} from "@/lib/db/call-repository";
import { resetDemoStore } from "@/lib/server/demo-store";
import {
  registerVoiceSession,
  removeVoiceSessionByLookupKey,
} from "./voiceSessionStore";

const cleanupKeys = new Set<string>();

const trackVoiceKey = (key: string): string => {
  cleanupKeys.add(key);
  return key;
};

afterEach(() => {
  resetDemoStore();
  for (const key of cleanupKeys) {
    removeVoiceSessionByLookupKey(key);
  }
  cleanupKeys.clear();
});

describe("resolveWebhookSession", () => {
  it("resolves two active sessions by their exact ElevenLabs conversation IDs", async () => {
    const sessionA = await repositoryCallStart({
      mode: "normal",
      twilio_call_sid: "CA-route-conv-A",
    });
    const sessionB = await repositoryCallStart({
      mode: "normal",
      twilio_call_sid: "CA-route-conv-B",
    });

    await repositoryPersistElevenLabsConversationId({
      call_session_id: sessionA.call_session_id,
      twilio_call_sid: "CA-route-conv-A",
      elevenlabs_conversation_id: "conv-route-A",
    });
    await repositoryPersistElevenLabsConversationId({
      call_session_id: sessionB.call_session_id,
      twilio_call_sid: "CA-route-conv-B",
      elevenlabs_conversation_id: "conv-route-B",
    });

    await expect(
      resolveWebhookSession({
        eventType: "llm_turn",
        conversationId: "conv-route-A",
        allowUnsafeFallback: false,
      })
    ).resolves.toMatchObject({
      incident_id: sessionA.incident_id,
      call_session_id: sessionA.call_session_id,
      elevenlabs_conversation_id: "conv-route-A",
      source: "db_conversation_id",
      used_fallback: false,
    });

    await expect(
      resolveWebhookSession({
        eventType: "llm_turn",
        conversationId: "conv-route-B",
        allowUnsafeFallback: false,
      })
    ).resolves.toMatchObject({
      incident_id: sessionB.incident_id,
      call_session_id: sessionB.call_session_id,
      elevenlabs_conversation_id: "conv-route-B",
      source: "db_conversation_id",
      used_fallback: false,
    });
  });

  it("prefers DB-backed Twilio identity over stale in-memory session aliases", async () => {
    const started = await repositoryCallStart({
      mode: "normal",
      twilio_call_sid: "CA-route-db-first",
    });

    registerVoiceSession({
      twilio_call_sid: trackVoiceKey("CA-route-db-first"),
      incident_id: "incident-stale-memory",
      call_session_id: "session-stale-memory",
      caller_phone: "+14155550100",
    });

    await expect(
      resolveWebhookSession({
        eventType: "llm_turn",
        twilioCallSid: "CA-route-db-first",
        allowUnsafeFallback: true,
      })
    ).resolves.toMatchObject({
      incident_id: started.incident_id,
      call_session_id: started.call_session_id,
      twilio_call_sid: "CA-route-db-first",
      source: "db_twilio_call_sid",
      used_fallback: false,
    });
  });

  it("refuses to guess when fallback has multiple recent phone sessions and no stable IDs", async () => {
    registerVoiceSession({
      twilio_call_sid: trackVoiceKey("CA-route-unsafe-A"),
      incident_id: "incident-unsafe-A",
      call_session_id: "session-unsafe-A",
      caller_phone: "+14155550200",
    });
    registerVoiceSession({
      twilio_call_sid: trackVoiceKey("CA-route-unsafe-B"),
      incident_id: "incident-unsafe-B",
      call_session_id: "session-unsafe-B",
      caller_phone: "+14155550300",
    });

    await expect(
      resolveWebhookSession({
        eventType: "llm_turn",
        allowUnsafeFallback: true,
      })
    ).resolves.toBeNull();
  });
});
