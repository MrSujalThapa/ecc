/**
 * Tool runtime contracts for the Call Triage Agent's two-pass loop.
 *
 * Mirrors the proposal in `docs/api_contracts_agentic_proposal.md` §"Tool Request"
 * and §"Tool Result". The AI emits `ToolRequest`s; the backend executes them via
 * `lib/ai/executeAllowedToolRequests.ts` and returns normalized `ToolResult`s.
 *
 * The schema in `lib/ai/schemas/triageAgentOutputSchema.ts` keeps a looser shape
 * (`{ tool, args, reason }`) so existing mock/Gemma outputs still validate.
 * The dispatcher fills in `id` + `safety_level` server-side.
 */

import type { GeoJsonGeometry } from "@/lib/types/geo";

export const SAFE_TOOL_NAMES = [
  "geocode_location",
  "event_zone_lookup",
  "responder_lookup",
  "sms_draft",
] as const;

export type SafeToolName = (typeof SAFE_TOOL_NAMES)[number];

export const isSafeToolName = (value: unknown): value is SafeToolName =>
  typeof value === "string" &&
  (SAFE_TOOL_NAMES as readonly string[]).includes(value);

export type ToolExecutionSource =
  | "mock"
  | "mapbox_mcp"
  | "mapbox_api"
  | "static_context"
  | "database"
  | "manual";

export type ToolSafetyLevel = "read_only" | "operator_confirm_required";

/**
 * Wire shape after the dispatcher normalizes the AI's loose
 * `{ tool, args, reason }` request into a fully identified request.
 */
export type ToolRequest = {
  id: string;
  tool: SafeToolName;
  args: Record<string, unknown>;
  reason: string;
  safety_level: ToolSafetyLevel;
};

export type ToolErrorCode =
  | "unknown_tool"
  | "mode_not_allowed"
  | "invalid_args"
  | "executor_error"
  | "executor_timeout";

export type ToolError = {
  code: ToolErrorCode;
  message: string;
  details?: unknown;
};

export type ToolResult<T = unknown> = {
  tool_request_id: string;
  tool: SafeToolName;
  ok: boolean;
  source: ToolExecutionSource;
  data?: T;
  error?: ToolError;
  created_at: string;
};

// --- Per-tool data shapes ----------------------------------------------------

export type Coordinates = {
  lat: number;
  lng: number;
};

export type GeocodeLocationData = {
  normalized_location: string;
  coordinates: Coordinates;
  confidence: number;
  provider_place_id?: string | null;
};

export type ResponderRecommendationItem = {
  responder_id: string;
  display_name: string;
  type: string;
  status: string;
  coordinates: Coordinates;
  distance_meters: number;
  reason: string;
};

export type ResponderLookupData = {
  recommendations: ResponderRecommendationItem[];
};

export type EventZoneLayerType =
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

export type EventZoneMatchItem = {
  layer_id: string;
  name: string;
  layer_type: EventZoneLayerType;
  distance_meters: number | null;
  contains_location: boolean;
  metadata: Record<string, unknown>;
};

export type EventZoneLookupData = {
  matches: EventZoneMatchItem[];
};

export type SmsDraftData = {
  message: string;
  language: string;
  character_count: number;
};

// Note: Additional tool data shapes can be added later, but only after
// they are specified in `docs/project_details.md` and `docs/api_contracts.md`.
