import { describe, expect, it } from "vitest";
import { mapCallSessionRow, mapIncidentRow, mapTranscriptRow } from "./mappers";

describe("mapIncidentRow", () => {
  it("maps a minimal Postgres-shaped row to Incident", () => {
    const row: Record<string, unknown> = {
      id: "inc-1",
      public_id: "INC-12345678",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      mode: "normal",
      urgency: "unknown",
      incident_type: "unknown",
      status: "active_call",
      operator_required: null,
      assigned_operator: null,
      control_state: "ai_leading",
      ai_active: true,
      location_status: "unknown",
      location_confidence: null,
      location: null,
      coordinates: { lat: 1.5, lng: -2.25 },
      summary: null,
      collected_fields: { a: 1 },
      missing_fields: ["x"],
      custom_fields: [],
      recommended_action: null,
      priority_score: null,
      cluster_id: null,
      transcript_url: null,
      audio_url: null,
      last_updated_by: "system",
    };
    const i = mapIncidentRow(row);
    expect(i.id).toBe("inc-1");
    expect(i.coordinates).toEqual({ lat: 1.5, lng: -2.25 });
    expect(i.collected_fields).toEqual({ a: 1 });
    expect(i.missing_fields).toEqual(["x"]);
  });

  it("treats null public_id as null", () => {
    const i = mapIncidentRow({
      id: "i",
      public_id: null,
      created_at: "t",
      updated_at: "t",
      mode: "disaster",
      urgency: "unknown",
      incident_type: "t",
      status: "active_call",
      operator_required: null,
      assigned_operator: null,
      control_state: "ai_leading",
      ai_active: true,
      location_status: "unknown",
      location_confidence: null,
      location: null,
      coordinates: null,
      summary: null,
      collected_fields: {},
      missing_fields: [],
      custom_fields: [],
      recommended_action: null,
      priority_score: null,
      cluster_id: null,
      transcript_url: null,
      audio_url: null,
      last_updated_by: "system",
    });
    expect(i.public_id).toBeNull();
  });
});

describe("mapCallSessionRow", () => {
  it("maps numeric turn_count and booleans", () => {
    const s = mapCallSessionRow({
      id: "s1",
      incident_id: "i1",
      twilio_call_sid: null,
      elevenlabs_conversation_id: null,
      status: "active",
      ai_active: true,
      turn_count: 3,
      recent_transcript: [],
      required_fields: [],
      missing_fields: [],
      next_question: null,
      last_model_confidence: null,
      should_escalate: false,
      operator_transfer_status: "not_requested",
      created_at: "t",
      updated_at: "t",
    });
    expect(s.turn_count).toBe(3);
    expect(s.status).toBe("active");
    expect(s.operator_transfer_status).toBe("not_requested");
    expect(s.caller_phone).toBeNull();
  });

  it("maps caller_phone when present", () => {
    const s = mapCallSessionRow({
      id: "s1",
      incident_id: "i1",
      twilio_call_sid: null,
      elevenlabs_conversation_id: null,
      caller_phone: "+14155551234",
      status: "active",
      ai_active: true,
      turn_count: 0,
      recent_transcript: [],
      required_fields: [],
      missing_fields: [],
      next_question: null,
      last_model_confidence: null,
      should_escalate: false,
      operator_transfer_status: "not_requested",
      created_at: "t",
      updated_at: "t",
    });
    expect(s.caller_phone).toBe("+14155551234");
  });
});

describe("mapTranscriptRow", () => {
  it("maps transcript fields", () => {
    const e = mapTranscriptRow({
      id: "e1",
      incident_id: "i1",
      call_session_id: "s1",
      speaker: "caller",
      text: "hi",
      is_final: true,
      language: null,
      translated_text: null,
      created_at: "t",
    });
    expect(e.text).toBe("hi");
    expect(e.is_final).toBe(true);
  });
});
