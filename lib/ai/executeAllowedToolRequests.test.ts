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
    expect(result.status).toBe("error");
    expect(result.args).toEqual({});
    expect(result.latency_ms).toBe(0);
    expect(result.created_at).toBeTruthy();
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
    expect(result.status).toBe("error");
    expect(result.args).toEqual({
      coordinates: { lat: 43.65, lng: -79.4 },
      mode: "world_cup",
    });
    expect(result.latency_ms).toBe(0);
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
    expect(result.status).toBe("error");
    expect(result.args).toEqual({ location_text: "" });
    expect(result.latency_ms).toBe(0);
    expect(result.error?.code).toBe("invalid_args");
  });

  it("runs geocode_location and returns a normalized result with provenance", async () => {
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
    expect(result.status).toBe("success");
    expect(result.tool).toBe("geocode_location");
    expect(result.args).toEqual({ location_text: "BMO Field" });
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    expect(result.created_at).toBeTruthy();
    const data = result.data as { coordinates: { lat: number; lng: number } };
    expect(data.coordinates.lat).toBeCloseTo(43.6328, 3);
    expect(data.coordinates.lng).toBeCloseTo(-79.4187, 3);
  });

  it("preserves mapbox_mcp provenance when geocode_location succeeds via MCP", async () => {
    process.env.MAPBOX_MCP_ENABLED = "true";
    process.env.MAPBOX_ACCESS_TOKEN = "pk.test";
    const originalFetch = global.fetch;
    global.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () =>
          `event: message\ndata: ${JSON.stringify({
            jsonrpc: "2.0",
            result: {
              structuredContent: {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [-79.4187, 43.6332] },
                    properties: {
                      mapbox_id: "mbx.123",
                      relevance: 0.98,
                      full_address: "BMO Field, Toronto, Ontario",
                    },
                  },
                ],
              },
            },
          })}\n\n`,
      }) as Response) as typeof fetch;

    try {
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

      const result = out.results[0]!;
      expect(result.ok).toBe(true);
      expect(result.status).toBe("success");
      expect(result.source).toBe("mapbox_mcp");
    } finally {
      global.fetch = originalFetch;
      delete process.env.MAPBOX_MCP_ENABLED;
      delete process.env.MAPBOX_ACCESS_TOKEN;
    }
  });

  it("preserves fallback provenance when geocode_location falls back from MCP", async () => {
    process.env.MAPBOX_MCP_ENABLED = "true";
    process.env.MAPBOX_ACCESS_TOKEN = "pk.test";
    const originalFetch = global.fetch;
    global.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () =>
          `event: message\ndata: ${JSON.stringify({
            jsonrpc: "2.0",
            result: {
              structuredContent: { type: "FeatureCollection", features: [] },
            },
          })}\n\n`,
      }) as Response) as typeof fetch;

    try {
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

      const result = out.results[0]!;
      expect(result.ok).toBe(true);
      expect(result.status).toBe("success");
      expect(result.source).toBe("static_context");
    } finally {
      global.fetch = originalFetch;
      delete process.env.MAPBOX_MCP_ENABLED;
      delete process.env.MAPBOX_ACCESS_TOKEN;
    }
  });

  it("marks sms_draft results with template provenance", async () => {
    const out = await executeAllowedToolRequests({
      mode: "world_cup",
      incident: baseIncident,
      callSession: baseSession,
      requests: [
        {
          tool: "sms_draft",
          args: {
            incident_id: "00000000-0000-0000-0000-000000000001",
            language: "en",
            summary: "Minor injury near Gate 3.",
          },
          reason: "draft follow-up",
        },
      ],
    });

    const result = out.results[0]!;
    expect(result.ok).toBe(true);
    expect(result.status).toBe("success");
    expect(result.source).toBe("template");
    expect(result.args).toEqual({
      incident_id: "00000000-0000-0000-0000-000000000001",
      language: "en",
      summary: "Minor injury near Gate 3.",
    });
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
    expect(out.results[0]!.status).toBe("success");
    expect(out.results[0]!.args).toEqual({ location_text: "Union Station" });
    expect(out.results[1]!.ok).toBe(false);
    expect(out.results[1]!.status).toBe("error");
  });
});
