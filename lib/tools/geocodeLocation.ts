/**
 * Mock geocoder. Looks up curated landmarks (case-insensitive substring match)
 * and falls back to a deterministic jitter around downtown Toronto so any
 * caller utterance still produces a stable map pin.
 *
 * Can be upgraded to a real geocoder later if needed.
 */

import { z } from "zod";
import type {
  GeocodeLocationData,
  ToolExecutionSource,
} from "@/lib/ai/toolResults";
import { geocodeWithMapboxMcp } from "@/lib/tools/mapbox/geocodeWithMapboxMcp";
import {
  LANDMARKS,
  TORONTO_CENTER,
  deterministicJitter,
} from "./_mockGeo";

export const geocodeLocationArgsSchema = z.object({
  location_text: z.string().trim().min(1, "location_text is required"),
  city_context: z.string().optional().nullable(),
  country_context: z.string().optional().nullable(),
});

export type GeocodeLocationArgs = z.infer<typeof geocodeLocationArgsSchema>;

export type GeocodeLocationOutput = {
  data: GeocodeLocationData;
  source: ToolExecutionSource;
};

const fallbackGeocodeLocation = async (
  args: GeocodeLocationArgs,
  fallbackContext?: {
    normalizedQuery?: string;
    providerStatus?: "error" | "unavailable";
    providerError?: string;
  },
): Promise<GeocodeLocationOutput> => {
  const needle = args.location_text.toLowerCase();
  const match = LANDMARKS.find((landmark) =>
    landmark.match.some((fragment) => needle.includes(fragment))
  );

  if (match) {
    return {
      data: {
        extracted_location: args.location_text,
        normalized_query: fallbackContext?.normalizedQuery ?? args.location_text,
        normalized_location: match.normalized_location,
        coordinates: match.coordinates,
        confidence: match.confidence,
        provider_place_id: match.provider_place_id,
        provider_status: fallbackContext?.providerStatus ?? "unavailable",
        provider_error: fallbackContext?.providerError ?? null,
      },
      source: "static_context",
    };
  }

  const fallbackCoords = deterministicJitter(needle);
  return {
    data: {
      extracted_location: args.location_text,
      normalized_query: fallbackContext?.normalizedQuery ?? args.location_text,
      normalized_location: `${args.location_text} (approximate, near ${TORONTO_CENTER.lat},${TORONTO_CENTER.lng})`,
      coordinates: fallbackCoords,
      confidence: 0.35,
      provider_place_id: null,
      provider_status: fallbackContext?.providerStatus ?? "unavailable",
      provider_error: fallbackContext?.providerError ?? null,
    },
    source: "mock",
  };
};

export const geocodeLocation = async (
  args: GeocodeLocationArgs
): Promise<GeocodeLocationOutput> => {
  const mcpResult = await geocodeWithMapboxMcp(args);

  if (mcpResult.status === "success" && mcpResult.coordinates) {
    return {
      data: {
        extracted_location: args.location_text,
        normalized_query: mcpResult.query,
        normalized_location: mcpResult.place_name ?? mcpResult.query,
        coordinates: {
          lat: mcpResult.coordinates.lat,
          lng: mcpResult.coordinates.lng,
        },
        confidence: mcpResult.confidence ?? 1,
        provider_place_id: mcpResult.provider_place_id ?? null,
        provider_status: "success",
        provider_error: null,
      },
      source: "mapbox_mcp",
    };
  }

  return fallbackGeocodeLocation(args, {
    normalizedQuery: mcpResult.query,
    providerStatus:
      mcpResult.status === "success" ? "error" : mcpResult.status,
    providerError: mcpResult.error,
  });
};
