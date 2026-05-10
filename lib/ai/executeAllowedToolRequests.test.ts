import { describe, expect, it } from "vitest";
import { executeAllowedToolRequests } from "./executeAllowedToolRequests";
import type { CallSession, Incident } from "@/lib/types/domain";

const baseIncident: Incident = {
  id: "inc-1",
  public_id: "INC-TEST",
  created_at: "2026-05-07T00:00:00.000Z",
  updated_at: "2026-05-07T00:00:00.000Z",
  mode: "world_cup",
  urgency: "urgent",
  incident_type: "lost_person",
  status: "active_call",
  operator_required: false,
  assigned_operator: null,
  control_state: "ai_leading",
  ai_active: true,
  location_status: "approximate_by_ai",
  location_confidence: 0.6,
  location: "Fan Zone East",
  coordinates: { lat: 43.6346, lng: -79.4151 },
  summary: "Lost tourist near fan zone east",
  collected_fields: {},
  missing_fields: [],
  custom_fields: [],
  recommended_action: null,
  priority_score: null,
  cluster_id: null,
  transcript_url: null,
  audio_url: null,
  last_updated_by: "triage_agent",
};

const baseSession: CallSession = {
  id: "ses-1",
  incident_id: "inc-1",
  twilio_call_sid: null,
  elevenlabs_conversation_id: null,
  caller_phone: null,
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
  created_at: "2026-05-07T00:00:00.000Z",
  updated_at: "2026-05-07T00:00:00.000Z",
};

describe("executeAllowedToolRequests", () => {
  it("rejects unknown tools without throwing", async () => {
    const out = await executeAllowedToolRequests({
      mode: "world_cup",
      incident: baseIncident,
      callSession: baseSession,
      requests: [
        { tool: "delete_database", args: {}, reason: "malicious" },
      ],
    });
    expect(out.results).toHaveLength(1);
    const result = out.results[0]!;
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("unknown_tool");
  });

  it("rejects tools not allowed in the current mode", async () => {
    const out = await executeAllowedToolRequests({
      mode: "normal",
      incident: { ...baseIncident, mode: "normal" },
      callSession: baseSession,
      requests: [
        {
          tool: "event_zone_lookup",
          args: { coordinates: { lat: 43.65, lng: -79.4 }, mode: "world_cup" },
          reason: "test",
        },
      ],
    });
    const result = out.results[0]!;
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("mode_not_allowed");
  });

  it("rejects requests with invalid args via the registry's Zod schema", async () => {
    const out = await executeAllowedToolRequests({
      mode: "world_cup",
      incident: baseIncident,
      callSession: baseSession,
      requests: [
        { tool: "geocode_location", args: { location_text: "" }, reason: "x" },
      ],
    });
    const result = out.results[0]!;
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("invalid_args");
  });

  it("runs geocode_location and returns a normalized result", async () => {
    const out = await executeAllowedToolRequests({
      mode: "world_cup",
      incident: baseIncident,
      callSession: baseSession,
      requests: [
        {
          tool: "geocode_location",
          args: { location_text: "BMO Field" },
          reason: "need pin",
        },
      ],
    });
    expect(out.requests).toHaveLength(1);
    expect(out.requests[0]?.id).toBeTruthy();
    expect(out.requests[0]?.safety_level).toBe("read_only");
    const result = out.results[0]!;
    expect(result.ok).toBe(true);
    expect(result.tool).toBe("geocode_location");
    const data = result.data as { coordinates: { lat: number; lng: number } };
    expect(data.coordinates.lat).toBeCloseTo(43.6328, 3);
    expect(data.coordinates.lng).toBeCloseTo(-79.4187, 3);
  });

  it("returns one result per request and preserves order", async () => {
    const out = await executeAllowedToolRequests({
      mode: "world_cup",
      incident: baseIncident,
      callSession: baseSession,
      requests: [
        { tool: "geocode_location", args: { location_text: "Union Station" }, reason: "" },
        { tool: "made_up_tool", args: {}, reason: "" },
      ],
    });
    expect(out.results).toHaveLength(2);
    expect(out.results[0]!.tool).toBe("geocode_location");
    expect(out.results[0]!.ok).toBe(true);
    expect(out.results[1]!.ok).toBe(false);
  });
});
