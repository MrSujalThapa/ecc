import { createMapboxMcpClient } from "@/lib/mcp/mapboxMcpClient";
import type { MapboxMcpClient } from "@/lib/mcp/types";
import type {
  MapboxGeocodeAdapterInput,
  MapboxGeocodeAdapterResultV2,
} from "@/lib/tools/mapbox/types";

const DEFAULT_MAPBOX_GEOCODE_TOOL = "search_and_geocode_tool";

const buildQuery = ({
  location_text,
  city_context,
  country_context,
}: MapboxGeocodeAdapterInput): string =>
  [location_text, city_context?.trim(), country_context?.trim()]
    .filter((value): value is string => Boolean(value && value.length > 0))
    .join(", ");

const tryParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const extractContentPayload = (content: unknown): unknown => {
  if (!Array.isArray(content) || content.length === 0) {
    return content;
  }

  const first = content[0];
  if (
    typeof first === "object" &&
    first !== null &&
    "text" in first &&
    typeof first.text === "string"
  ) {
    return tryParseJson(first.text);
  }

  return content;
};

const extractFirstMatch = (value: unknown): Record<string, unknown> | null => {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "object" && first !== null
      ? (first as Record<string, unknown>)
      : null;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const features = record.features;
  if (Array.isArray(features)) {
    const first = features[0];
    return typeof first === "object" && first !== null
      ? (first as Record<string, unknown>)
      : null;
  }

  return record;
};

const extractCoordinates = (
  value: Record<string, unknown>
): { lng: number; lat: number } | null => {
  const geometry = value.geometry;
  if (
    typeof geometry === "object" &&
    geometry !== null &&
    "coordinates" in geometry &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length >= 2
  ) {
    const [lng, lat] = geometry.coordinates;
    if (typeof lng === "number" && typeof lat === "number") {
      return { lng, lat };
    }
  }

  const coordinates = value.coordinates;
  if (typeof coordinates === "object" && coordinates !== null) {
    const lng = "longitude" in coordinates ? coordinates.longitude : undefined;
    const lat = "latitude" in coordinates ? coordinates.latitude : undefined;
    if (typeof lng === "number" && typeof lat === "number") {
      return { lng, lat };
    }
  }

  return null;
};

const extractNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

export const geocodeWithMapboxMcp = async (
  input: MapboxGeocodeAdapterInput,
  options?: {
    client?: MapboxMcpClient;
    toolName?: string;
  }
): Promise<MapboxGeocodeAdapterResultV2> => {
  const client = options?.client ?? createMapboxMcpClient();
  const toolName = options?.toolName ?? DEFAULT_MAPBOX_GEOCODE_TOOL;
  const query = buildQuery(input);

  const toolResult = await client.callTool({
    toolName,
    arguments: { query },
  });

  if (!toolResult.ok) {
    return {
      status:
        toolResult.code === "disabled" || toolResult.code === "not_configured"
          ? "unavailable"
          : "error",
      source: "mapbox_mcp",
      query,
      raw: toolResult.raw,
      error: toolResult.message,
    };
  }

  const payload = extractContentPayload(toolResult.content);
  const firstMatch = extractFirstMatch(payload);

  if (!firstMatch) {
    return {
      status: "error",
      source: "mapbox_mcp",
      query,
      raw: toolResult.raw,
      error: "Mapbox MCP returned no geocode matches.",
    };
  }

  const coordinates = extractCoordinates(firstMatch);
  if (!coordinates) {
    return {
      status: "error",
      source: "mapbox_mcp",
      query,
      raw: toolResult.raw,
      error: "Mapbox MCP returned a geocode match without usable coordinates.",
    };
  }

  return {
    status: "success",
    source: "mapbox_mcp",
    query,
    coordinates,
    place_name:
      (typeof firstMatch.place_name === "string" && firstMatch.place_name) ||
      (typeof firstMatch.name === "string" && firstMatch.name) ||
      query,
    confidence:
      extractNumber(firstMatch.confidence) ??
      extractNumber(firstMatch.relevance) ??
      1,
    provider_place_id:
      (typeof firstMatch.mapbox_id === "string" && firstMatch.mapbox_id) ||
      (typeof firstMatch.id === "string" && firstMatch.id) ||
      null,
    raw: toolResult.raw,
  };
};
