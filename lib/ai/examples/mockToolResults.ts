import type { ToolResult } from "../schemas/toolResultSchema";
import type { SafeToolName } from "../schemas/toolRequestSchema";

const CREATED_AT = "2026-05-07T00:00:00.000Z";

export const mockToolResults = [
  {
    tool_request_id: "tr-bike-dp-geocode",
    tool: "geocode_location",
    ok: true,
    source: "mapbox_api",
    data: {
      normalized_location: "Dana Porter Library",
      coordinates: { lat: 43.4699, lng: -80.5424 },
      confidence: 0.86,
      provider_place_id: "mock-mapbox-dana-porter-library",
    },
    created_at: CREATED_AT,
  },
  {
    tool_request_id: "tr-gas-king-geocode",
    tool: "geocode_location",
    ok: true,
    source: "mapbox_api",
    data: {
      normalized_location: "King Street, Waterloo",
      coordinates: { lat: 43.4653, lng: -80.5228 },
      confidence: 0.72,
      provider_place_id: "mock-mapbox-king-street-waterloo",
    },
    created_at: CREATED_AT,
  },
  {
    tool_request_id: "tr-medical-gate3-zone",
    tool: "event_zone_lookup",
    ok: true,
    source: "database",
    data: {
      matches: [
        {
          layer_id: "wc-gate-3",
          name: "Gate 3 Entrance",
          layer_type: "stadium_perimeter",
          distance_meters: 45,
          contains_location: true,
          metadata: {
            nearest_section: "East Concourse",
            crowd_level: "high",
          },
        },
      ],
    },
    created_at: CREATED_AT,
  },
  {
    tool_request_id: "tr-lost-child-zone",
    tool: "event_zone_lookup",
    ok: true,
    source: "database",
    data: {
      matches: [
        {
          layer_id: "wc-fan-zone-main",
          name: "Main Fan Zone",
          layer_type: "fan_zone",
          distance_meters: 20,
          contains_location: true,
          metadata: {
            nearest_gate: "Gate 2",
            expected_density: "very_high",
          },
        },
      ],
    },
    created_at: CREATED_AT,
  },
  {
    tool_request_id: "tr-medical-gate3-help",
    tool: "responder_lookup",
    ok: true,
    source: "database",
    data: {
      responders: [
        {
          id: "MED-3",
          type: "medical",
          status: "available",
          display_name: "Gate 3 Medical Team",
          coordinates: { lat: 43.6429, lng: -79.3871 },
          distance_meters: 110,
          metadata: {
            staffed: true,
            zone: "East Concourse",
          },
        },
      ],
    },
    created_at: CREATED_AT,
  },
  {
    tool_request_id: "tr-lost-child-help",
    tool: "responder_lookup",
    ok: true,
    source: "database",
    data: {
      responders: [
        {
          id: "SEC-LOST-1",
          type: "security",
          status: "available",
          display_name: "Fan Zone Security Team",
          coordinates: { lat: 43.6422, lng: -79.3864 },
          distance_meters: 160,
          metadata: {
            lost_child_response: true,
            languages: ["en", "fr", "es"],
          },
        },
      ],
    },
    created_at: CREATED_AT,
  },
  {
    tool_request_id: "tr-trapped-responder",
    tool: "responder_lookup",
    ok: true,
    source: "database",
    data: {
      responders: [
        {
          id: "EMS-2",
          type: "ambulance",
          status: "available",
          display_name: "EMS Unit 2",
          coordinates: { lat: 43.4661, lng: -80.524 },
          distance_meters: 850,
        },
      ],
    },
    created_at: CREATED_AT,
  },
  {
    tool_request_id: "tr-trapped-route",
    tool: "responder_lookup",
    ok: true,
    source: "database",
    data: {
      responders: [
        {
          id: "FIRE-4",
          type: "fire_rescue",
          status: "available",
          display_name: "Fire Rescue Unit 4",
          coordinates: { lat: 43.4668, lng: -80.5255 },
          distance_meters: 1320,
        },
      ],
      notes:
        "Route geometry is future-only; current fixture uses responder_lookup.",
    },
    created_at: CREATED_AT,
  },
  {
    tool_request_id: "tr-gas-king-context",
    tool: "event_zone_lookup",
    ok: true,
    source: "static_context",
    data: {
      matches: [
        {
          layer_id: "disaster-king-street",
          name: "King Street Earthquake Impact Area",
          layer_type: "disaster_zone",
          distance_meters: 120,
          contains_location: true,
          metadata: {
            reported_hazards: ["gas_smell", "debris"],
            notes: "Context lookup is future-only; event_zone_lookup carries current fixture context.",
          },
        },
      ],
      confidence: 0.74,
    },
    created_at: CREATED_AT,
  },
  {
    tool_request_id: "tr-crowd-gate-context",
    tool: "event_zone_lookup",
    ok: true,
    source: "static_context",
    data: {
      matches: [
        {
          layer_id: "wc-stadium-gate-crowd",
          name: "Stadium Gate Crowd Area",
          layer_type: "stadium_gate",
          distance_meters: 35,
          contains_location: true,
          metadata: {
            crowd_level: "high",
            notes: "Context lookup is future-only; event_zone_lookup carries current fixture context.",
          },
        },
      ],
      confidence: 0.82,
    },
    created_at: CREATED_AT,
  },
  {
    tool_request_id: "tr-bike-dp-sms",
    tool: "sms_draft",
    ok: true,
    source: "mock",
    data: {
      should_send: true,
      message:
        "Your report was received. Summary: stolen bike near Dana Porter Library.",
      language: "en",
      tone: "factual",
    },
    created_at: CREATED_AT,
  },
] as unknown as ToolResult[];

export function getMockToolResultsByTool(toolName: SafeToolName): ToolResult[] {
  return mockToolResults.filter((result) => result.tool === toolName);
}
