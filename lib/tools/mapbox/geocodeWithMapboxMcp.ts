import { createMapboxMcpClient } from "@/lib/mcp/mapboxMcpClient";
import type { MapboxMcpClient } from "@/lib/mcp/types";
import type {
  MapboxGeocodeAdapterInput,
  MapboxGeocodeAdapterResultV2,
} from "@/lib/tools/mapbox/types";

const DEFAULT_MAPBOX_GEOCODE_TOOL = "search_and_geocode_tool";

const normalizeQuerySegment = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const buildQuery = ({
  location_text,
  city_context,
  country_context,
}: MapboxGeocodeAdapterInput): string => {
  const parts: string[] = [];

  for (const candidate of [
    location_text.trim(),
    city_context?.trim() ?? "",
    country_context?.trim() ?? "",
  ]) {
    if (candidate.length === 0) {
      continue;
    }
    const normalizedCandidate = normalizeQuerySegment(candidate);
    const alreadyPresent = parts.some((part) =>
      normalizeQuerySegment(part).includes(normalizedCandidate),
    );
    if (!alreadyPresent) {
      parts.push(candidate);
    }
  }

  return parts.join(", ");
};

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

const extractMatches = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null,
    );
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const features = record.features;
  if (Array.isArray(features)) {
    return features.filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null,
    );
  }

  return [record];
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

const tokenize = (value: string): string[] =>
  normalizeQuerySegment(value)
    .split(/\s+/)
    .filter((token) => token.length > 0);

const extractMatchText = (value: Record<string, unknown>): string =>
  [
    typeof value.place_name === "string" ? value.place_name : "",
    typeof value.name === "string" ? value.name : "",
    typeof value.address === "string" ? value.address : "",
  ]
    .filter((segment) => segment.length > 0)
    .join(" ");

const scoreMatch = (query: string, value: Record<string, unknown>): number => {
  const matchText = extractMatchText(value);
  const normalizedQuery = normalizeQuerySegment(query);
  const normalizedMatch = normalizeQuerySegment(matchText);
  const queryTokens = tokenize(query);
  const numericTokens = queryTokens.filter((token) => /\d/.test(token));
  const overlapCount = queryTokens.filter((token) =>
    normalizedMatch.includes(token),
  ).length;
  const numericOverlap = numericTokens.filter((token) =>
    normalizedMatch.includes(token),
  ).length;
  const baseConfidence =
    extractNumber(value.relevance) ?? extractNumber(value.confidence) ?? 0;

  let score = baseConfidence;
  score += overlapCount * 5;
  score += numericOverlap * 20;

  if (normalizedMatch.includes(normalizedQuery)) {
    score += 100;
  }

  if (numericTokens.length > 0 && numericOverlap === numericTokens.length) {
    score += 25;
  }

  return score;
};

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
  const matches = extractMatches(payload);
  const firstMatch =
    matches.length === 0
      ? null
      : [...matches].sort((a, b) => scoreMatch(query, b) - scoreMatch(query, a))[0] ?? null;

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
    selected_match_text: extractMatchText(firstMatch) || null,
    raw: toolResult.raw,
  };
};
