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

export type MapboxGeocodeAdapterInput = {
  location_text: string;
  city_context?: string | null;
  country_context?: string | null;
};

export type MapboxGeocodeAdapterStatus =
  | "success"
  | "error"
  | "unavailable";

export type MapboxGeocodeAdapterResultV2 = {
  status: MapboxGeocodeAdapterStatus;
  source: "mapbox_mcp";
  query: string;
  coordinates?: { lng: number; lat: number };
  place_name?: string;
  confidence?: number;
  provider_place_id?: string | null;
  raw?: unknown;
  error?: string;
  selected_match_text?: string | null;
};
