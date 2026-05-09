# API Contracts Agentic Proposal

## Status

This is a **proposal** for the upgraded Featherless + controlled tool runtime + Mapbox MCP architecture.

It does **not** replace `docs/api_contracts.md` yet.

The current `docs/api_contracts.md` remains the active contract source until the team agrees to migrate these proposal types into:

```text
docs/api_contracts.md
lib/types/api.ts
lib/types/ai.ts
lib/ai/schemas/*
lib/validation/*
backend route handlers
frontend adapters
mock data
```

---

## Purpose

This proposal defines the new contracts needed for:

```text
- Featherless tool-using agents
- backend safe tool execution
- Mapbox MCP runtime tools
- RAG-lite / structured context lookup
- route recommendations
- nearest help-point recommendations
- responder recommendations
- enhanced surge / GeoOps output
- multilingual caller support
- SMS draft/status behavior
```

---

## Contract Principles

1. AI must not execute side effects directly.
2. AI may request tools.
3. Backend validates tool requests.
4. Backend executes allowed tools.
5. Backend normalizes tool results.
6. AI may reason over tool results.
7. Backend validates final output before persistence.
8. Dashboard visualizes typed backend outputs.
9. Frontend does not call Featherless or runtime Mapbox MCP directly.
10. Current MVP endpoints should keep working.

---

## Shared Types

```ts
export type UUID = string;
export type ISODateString = string;

export type Coordinates = {
  lat: number;
  lng: number;
};

export type SystemMode = "normal" | "disaster" | "world_cup";

export type ToolExecutionSource =
  | "mock"
  | "mapbox_mcp"
  | "mapbox_api"
  | "static_context"
  | "database"
  | "manual";
```

---

## Safe Tool Names

```ts
export type SafeToolName =
  | "geocode_location"
  | "reverse_geocode"
  | "event_zone_lookup"
  | "nearest_help_point_lookup"
  | "responder_lookup"
  | "route_between_points"
  | "travel_time_matrix"
  | "isochrone_lookup"
  | "context_lookup"
  | "sms_draft";
```

---

## Tool Request

Tool requests are produced by the AI agent. They are not automatically executed.

```ts
export type ToolRequest = {
  id: string;
  tool: SafeToolName;
  args: Record<string, unknown>;
  reason: string;
  safety_level: "read_only" | "operator_confirm_required";
};
```

Rules:

```text
- Backend rejects unknown tools.
- Backend validates args by tool.
- Backend may reject tools not allowed in current mode.
- Backend must not execute side-effect tools without validation.
```

---

## Tool Result

Tool results are produced by the backend.

```ts
export type ToolResult<T = unknown> = {
  tool_request_id: string;
  tool: SafeToolName;
  ok: boolean;
  source: ToolExecutionSource;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  created_at: ISODateString;
};
```

Rules:

```text
- ToolResult should be normalized.
- Do not pass raw provider responses directly to the frontend.
- Sensitive details should be stripped before storage/UI.
```

---

## Tool Argument and Result Shapes

## Geocode Location

```ts
export type GeocodeLocationArgs = {
  location_text: string;
  city_context?: string | null;
  country_context?: string | null;
  bias_coordinates?: Coordinates | null;
};

export type GeocodeLocationResult = {
  normalized_location: string;
  coordinates: Coordinates;
  confidence: number;
  provider_place_id?: string | null;
};
```

## Reverse Geocode

```ts
export type ReverseGeocodeArgs = {
  coordinates: Coordinates;
};

export type ReverseGeocodeResult = {
  address_label: string;
  neighborhood?: string | null;
  place_name?: string | null;
  confidence: number;
};
```

## Event Zone Lookup

```ts
export type EventZoneLookupArgs = {
  coordinates?: Coordinates | null;
  location_text?: string | null;
  mode: "world_cup" | "disaster";
};

export type EventZoneMatch = {
  layer_id: string;
  name: string;
  layer_type:
    | "stadium_perimeter"
    | "fan_zone"
    | "medical_tent"
    | "police_tent"
    | "security_tent"
    | "lost_and_found"
    | "tourist_help"
    | "transit_node"
    | "restricted_vehicle_zone"
    | "crowd_density_zone"
    | "road_closure"
    | "impact_zone"
    | "blocked_road"
    | "responder_staging_area";
  distance_meters?: number | null;
  contains_location: boolean;
  metadata: Record<string, unknown>;
};

export type EventZoneLookupResult = {
  matches: EventZoneMatch[];
};
```

## Nearest Help Point Lookup

```ts
export type HelpPointType =
  | "medical_tent"
  | "police_tent"
  | "security_tent"
  | "lost_and_found"
  | "tourist_help"
  | "transit_node"
  | "shelter"
  | "mechanic_or_roadside_help";

export type NearestHelpPointLookupArgs = {
  from: Coordinates;
  help_point_types: HelpPointType[];
  mode: SystemMode;
  max_results?: number;
};

export type HelpPointRecommendation = {
  id: string;
  type: HelpPointType;
  name: string;
  coordinates: Coordinates;
  distance_meters: number;
  route_summary?: string | null;
  metadata: Record<string, unknown>;
};

export type NearestHelpPointLookupResult = {
  recommendations: HelpPointRecommendation[];
};
```

## Responder Lookup

```ts
export type ResponderLookupArgs = {
  incident_id?: UUID | null;
  incident_coordinates: Coordinates;
  responder_types?: ("ambulance" | "fire" | "police" | "event_staff")[];
  max_results?: number;
};

export type ResponderRecommendation = {
  responder_id: string;
  display_name: string;
  type: "ambulance" | "fire" | "police" | "event_staff";
  status: "available" | "assigned" | "en_route" | "busy" | "offline";
  coordinates: Coordinates;
  distance_meters: number;
  estimated_travel_seconds?: number | null;
  reason: string;
};

export type ResponderLookupResult = {
  recommendations: ResponderRecommendation[];
};
```

## Route Between Points

```ts
export type RouteBetweenPointsArgs = {
  from: Coordinates;
  to: Coordinates;
  profile?: "driving" | "walking" | "cycling";
  avoid_layer_ids?: string[];
};

export type RouteRecommendation = {
  id: string;
  from: Coordinates;
  to: Coordinates;
  profile: "driving" | "walking" | "cycling";
  distance_meters: number;
  duration_seconds: number;
  geometry: GeoJSON.LineString;
  reason: string;
  warnings: string[];
};

export type RouteBetweenPointsResult = {
  route: RouteRecommendation;
};
```

## Travel Time Matrix

```ts
export type TravelTimeMatrixArgs = {
  origins: Coordinates[];
  destinations: Coordinates[];
  profile?: "driving" | "walking" | "cycling";
};

export type TravelTimeMatrixResult = {
  durations_seconds: number[][];
  distances_meters?: number[][];
};
```

## Isochrone Lookup

```ts
export type IsochroneLookupArgs = {
  center: Coordinates;
  profile?: "driving" | "walking" | "cycling";
  minutes: number[];
};

export type IsochroneLookupResult = {
  polygons: GeoJSON.FeatureCollection;
};
```

## Context Lookup

```ts
export type ContextLookupArgs = {
  mode: SystemMode;
  incident_type?: string | null;
  coordinates?: Coordinates | null;
  language?: string | null;
};

export type ContextLookupResult = {
  relevant_sops: string[];
  sms_templates: SmsTemplate[];
  event_layers: EventZoneMatch[];
  notes: string[];
};
```

## SMS Draft

```ts
export type SmsDraftArgs = {
  incident_id: UUID;
  language: string;
  summary: string;
  recommended_action?: string | null;
  destination?: HelpPointRecommendation | null;
  reference_code?: string | null;
};

export type SmsDraftResult = {
  message: string;
  language: string;
  character_count: number;
};
```

---

## Agent Context Pack

The backend builds this before calling the agent.

```ts
export type AgentContextPack = {
  mode: SystemMode;
  current_incident_id: UUID;
  language_hint?: string | null;

  nearby_event_zones?: EventZoneMatch[];
  nearby_help_points?: HelpPointRecommendation[];
  nearby_responders?: ResponderRecommendation[];
  blocked_roads?: EventZoneMatch[];

  relevant_sops?: string[];
  sms_templates?: SmsTemplate[];

  notes?: string[];
};
```

---

## Call Triage Agent Output v2

```ts
export type AgentDecision =
  | "continue_ai_handling"
  | "complete_ai_report"
  | "ask_location_then_escalate"
  | "escalate_to_operator"
  | "operator_review_recommended";

export type LanguageState = {
  detected_language: string | null;
  translated_to_english: boolean;
  caller_response_language: string;
};

export type CallerResponse = {
  type: "say" | "transfer_notice" | "end_call";
  text: string;
  language: string;
};

export type OperatorRecommendation = {
  operator_required: boolean;
  priority_reason: string | null;
  recommended_action: string | null;
};

export type SmsDraftState = {
  should_send: boolean;
  message: string | null;
  language: string | null;
};

export type MapRecommendation = {
  focus_coordinates?: Coordinates | null;
  relevant_zone_ids?: string[];
  nearest_help_point_id?: string | null;
  route_recommendation_ids?: string[];
  responder_recommendation_ids?: string[];
};

export type AgentConfidence = {
  overall: number;
  location: number | null;
  urgency: number;
};

export type CallTriageAgentOutputV2 = {
  schema_version: "2.0";
  mode: SystemMode;
  language: LanguageState;

  decision: AgentDecision;

  tool_requests: ToolRequest[];

  incident_patch: Partial<Incident>;
  call_session_patch: Partial<CallSession>;

  caller_response: CallerResponse;
  operator_recommendation: OperatorRecommendation;

  sms_draft: SmsDraftState;
  map_recommendation: MapRecommendation;

  confidence: AgentConfidence;
};
```

Compatibility note:

```text
Current MVP can keep using CallTriageAgentOutput v1.
The v2 output should be introduced behind validation and provider feature flags.
```

---

## Surge / GeoOps Agent Output

```ts
export type GeoOpsRecommendation = {
  id: string;
  type:
    | "operator_focus"
    | "route"
    | "responder_assignment"
    | "help_point"
    | "cluster_attention"
    | "blocked_road_warning";
  title: string;
  summary: string;
  incident_ids: UUID[];
  route_ids?: string[];
  responder_ids?: string[];
  event_layer_ids?: string[];
  priority_score: number;
  requires_operator_confirmation: boolean;
};

export type SurgeGeoOpsAgentOutput = {
  schema_version: "1.0";
  mode: "disaster" | "world_cup";

  clusters: SurgeCluster[];
  top_priority_incident_ids: UUID[];

  route_recommendations: RouteRecommendation[];
  responder_recommendations: ResponderRecommendation[];
  help_point_recommendations: HelpPointRecommendation[];
  event_zone_matches: EventZoneMatch[];

  geoops_recommendations: GeoOpsRecommendation[];

  summary: string;
  confidence: number;
};
```

---

## Proposed Endpoint: `POST /api/surge/analyze`

Current `docs/api_contracts.md` already includes `/api/surge/analyze`, but this proposal expands its future response shape.

### Request

```ts
export type SurgeAnalyzeRequestV2 = {
  mode: "disaster" | "world_cup";
  include_responders?: boolean;
  include_event_layers?: boolean;
  include_routes?: boolean;
  incident_ids?: UUID[];
};
```

### Response

```ts
export type SurgeAnalyzeResponseV2 = {
  clusters: SurgeCluster[];
  updated_incidents: Incident[];
  top_priority_incident_ids: UUID[];

  route_recommendations: RouteRecommendation[];
  responder_recommendations: ResponderRecommendation[];
  help_point_recommendations: HelpPointRecommendation[];
  event_zone_matches: EventZoneMatch[];
  geoops_recommendations: GeoOpsRecommendation[];
};
```

---

## Proposed Non-Public Backend Function: `executeAllowedToolRequests`

This should be a backend helper, not a public route unless the team explicitly decides otherwise.

```ts
export async function executeAllowedToolRequests(input: {
  mode: SystemMode;
  incident: Incident;
  callSession: CallSession;
  requests: ToolRequest[];
  context: AgentContextPack;
}): Promise<ToolResult[]>;
```

Rules:

```text
- validate each ToolRequest
- reject unknown tools
- apply mode restrictions
- execute mock or Mapbox-backed tool
- normalize ToolResult
- audit important tool execution
- never let raw LLM call arbitrary services
```

---

## Dashboard Consumption

Member 4 should eventually visualize these backend-provided outputs:

```text
RouteRecommendation.geometry as Mapbox line layer
HelpPointRecommendation as help-point markers/cards
ResponderRecommendation as responder recommendation panel
EventZoneMatch as zone badge/highlight
GeoOpsRecommendation as operator recommendation card
LanguageState as caller language badge
SmsDraftState as SMS draft/status display
ToolResult status/confidence as optional debug/operator info
```

Member 4 should not call Featherless or runtime Mapbox MCP from the frontend.

---

## Migration Plan

1. Keep current `docs/api_contracts.md` active.
2. Review this proposal with Members 1, 3, and 4.
3. Agree on final names and fields.
4. Update `docs/api_contracts.md`.
5. Update `/lib/types/api.ts` and `/lib/types/ai.ts`.
6. Update Zod schemas.
7. Update mock data.
8. Update backend tool runtime.
9. Update AI prompts/provider outputs.
10. Update dashboard adapters/components.

---

## Non-Goals For First Implementation

```text
No autonomous dispatch.
No direct frontend Mapbox MCP calls.
No direct LLM side effects.
No complex vector database requirement.
No production SMS/call transfer dependency.
No replacement of working Phase 1/2 dashboard.
```
