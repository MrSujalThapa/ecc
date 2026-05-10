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
    tool: "nearest_help_point_lookup",
    ok: true,
    source: "database",
    data: {
      recommendations: [
        {
          id: "hp-medical-tent-east",
          type: "medical_tent",
          name: "East Medical Tent",
          coordinates: { lat: 43.6429, lng: -79.3871 },
          distance_meters: 110,
          route_summary: "Follow signs toward East Concourse medical tent.",
          metadata: {
            staffed: true,
            open: true,
          },
        },
      ],
    },
    created_at: CREATED_AT,
  },
  {
    tool_request_id: "tr-lost-child-help",
    tool: "nearest_help_point_lookup",
    ok: true,
    source: "database",
    data: {
      recommendations: [
        {
          id: "hp-lost-found-main",
          type: "lost_and_found",
          name: "Main Lost and Found",
          coordinates: { lat: 43.6422, lng: -79.3864 },
          distance_meters: 160,
          route_summary: "Located beside the main information booth.",
          metadata: {
            security_staff_present: true,
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
    tool: "route_between_points",
    ok: true,
    source: "mapbox_mcp",
    data: {
      route_id: "route-ems2-to-trapped-placeholder",
      distance_meters: 1320,
      duration_seconds: 410,
      geometry: {
        type: "LineString",
        coordinates: [
          [-80.524, 43.4661],
          [-80.5252, 43.467],
          [-80.5264, 43.468],
        ],
      },
      notes: "Placeholder mock route geometry for future tests only.",
    },
    created_at: CREATED_AT,
  },
  {
    tool_request_id: "tr-gas-king-context",
    tool: "context_lookup",
    ok: true,
    source: "static_context",
    data: {
      context_id: "ctx-disaster-king-blocked-roads",
      title: "Disaster blocked-road notes near King Street",
      snippets: [
        "Multiple reports mention debris near King Street after the earthquake.",
        "Operators should verify access routes before recommending responder movement.",
      ],
      confidence: 0.74,
    },
    created_at: CREATED_AT,
  },
  {
    tool_request_id: "tr-crowd-gate-context",
    tool: "context_lookup",
    ok: true,
    source: "static_context",
    data: {
      context_id: "ctx-world-cup-crowd-safety",
      title: "World Cup event crowd safety notes",
      snippets: [
        "Crowd pushing near gates should be surfaced to operators for review.",
        "Do not provide tactical crowd-control instructions to callers.",
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
