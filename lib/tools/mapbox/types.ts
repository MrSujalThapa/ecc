import type {
  GeocodeLocationData,
  ToolError,
  ToolExecutionSource,
} from "@/lib/ai/toolResults";

export type MapboxToolFallbackPolicy =
  | "use_existing_mock_tool"
  | "return_tool_error";

export type MapboxToolAdapterName =
  | "geocode_location"
  | "search_place"
  | "reverse_geocode"
  | "event_zone_lookup";

export type MapboxToolExecutionSource = Extract<
  ToolExecutionSource,
  "mapbox_mcp" | "mapbox_api" | "mock" | "static_context" | "manual"
>;

export type MapboxToolAdapterResult<T = unknown> = {
  ok: boolean;
  source: MapboxToolExecutionSource;
  data?: T;
  error?: ToolError;
};

export type MapboxGeocodeAdapterResult =
  MapboxToolAdapterResult<GeocodeLocationData>;
