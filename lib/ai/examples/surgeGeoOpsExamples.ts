import type { RunSurgeGeoOpsAgentInput } from "../agents/surgeGeoOpsAgent";

export const surgeGeoOpsExampleInputs: RunSurgeGeoOpsAgentInput[] = [
  {
    mode: "disaster",
    provider: "mock",
    activeIncidents: [
      {
        id: "DIS-001",
        cluster_id: "earthquake-downtown",
        mode: "disaster",
        urgency: "critical",
        incident_type: "trapped_person",
        summary: "Caller reports a trapped person near a collapsed structure.",
        coordinates: { lat: 43.4651, lng: -80.5229 },
      },
      {
        id: "DIS-002",
        cluster_id: "earthquake-downtown",
        mode: "disaster",
        urgency: "critical",
        incident_type: "gas_leak",
        summary: "Strong gas smell reported after earthquake.",
        coordinates: { lat: 43.4662, lng: -80.5234 },
      },
      {
        id: "DIS-003",
        cluster_id: "earthquake-downtown",
        mode: "disaster",
        urgency: "urgent",
        incident_type: "blocked_road",
        summary: "Debris is blocking a key road near King Street.",
        coordinates: { lat: 43.4645, lng: -80.524 },
      },
      {
        id: "DIS-004",
        mode: "disaster",
        urgency: "urgent",
        incident_type: "medical_emergency",
        summary: "Minor injuries reported near a shelter entrance.",
        coordinates: { lat: 43.468, lng: -80.5262 },
      },
    ],
    responders: [
      {
        id: "EMS-2",
        display_name: "EMS Unit 2",
        type: "ambulance",
        status: "available",
        coordinates: { lat: 43.4661, lng: -80.524 },
        distance_meters: 850,
      },
    ],
    eventLayers: [
      {
        id: "impact-zone-downtown",
        name: "Downtown Earthquake Impact Zone",
        layer_type: "impact_zone",
        contains_location: true,
        metadata: { severity: "high" },
      },
    ],
    recentToolResults: [
      {
        tool_request_id: "ctx-disaster-blocked-roads",
        tool: "context_lookup",
        ok: true,
        source: "static_context",
        data: {
          notes: ["King Street has multiple blocked-road reports."],
        },
        created_at: "2026-05-08T00:00:00.000Z",
      },
    ],
  },
  {
    mode: "world_cup",
    provider: "mock",
    activeIncidents: [
      {
        id: "WC-101",
        cluster_id: "stadium-gate-3",
        mode: "world_cup",
        urgency: "critical",
        incident_type: "missing_person",
        summary: "Lost child near the fan zone.",
        coordinates: { lat: 43.6422, lng: -79.3864 },
      },
      {
        id: "WC-102",
        cluster_id: "stadium-gate-3",
        mode: "world_cup",
        urgency: "urgent",
        incident_type: "crowd_surge",
        summary: "Crowd pushing near the stadium gate.",
        coordinates: { lat: 43.6427, lng: -79.3869 },
      },
      {
        id: "WC-103",
        cluster_id: "stadium-gate-3",
        mode: "world_cup",
        urgency: "critical",
        incident_type: "medical_emergency",
        summary: "Medical collapse near Gate 3.",
        coordinates: { lat: 43.6429, lng: -79.3871 },
      },
    ],
    responders: [
      {
        id: "SEC-4",
        display_name: "Security Team 4",
        type: "event_staff",
        status: "available",
        coordinates: { lat: 43.6425, lng: -79.3867 },
        distance_meters: 90,
      },
    ],
    eventLayers: [
      {
        id: "wc-gate-3",
        name: "Gate 3 Entrance",
        layer_type: "stadium_perimeter",
        distance_meters: 30,
        contains_location: true,
        metadata: { crowd_level: "high" },
      },
      {
        id: "wc-fan-zone-main",
        name: "Main Fan Zone",
        layer_type: "fan_zone",
        distance_meters: 80,
        contains_location: true,
        metadata: { help_points_nearby: true },
      },
    ],
    recentToolResults: [
      {
        tool_request_id: "help-gate-3",
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
              route_summary: "Follow the East Concourse signs.",
              metadata: { staffed: true },
            },
          ],
        },
        created_at: "2026-05-08T00:00:00.000Z",
      },
    ],
  },
  {
    mode: "disaster",
    provider: "mock",
    activeIncidents: [],
    responders: [],
    eventLayers: [],
    recentToolResults: [],
  },
];

export const expectedSurgeGeoOpsNotes = [
  "Disaster example should produce a high-priority cluster and operator focus recommendation.",
  "World Cup example should prioritize lost child, crowd surge, and medical emergency near event zones.",
  "Empty incident list should return a valid empty output with a no-active-incidents summary.",
  "Examples are static fixtures only and do not call runSurgeGeoOpsAgent automatically.",
];
