/**
 * Mock event-zone lookup. Given a coordinate (and a mode), reports which
 * pre-seeded zones it falls inside (`contains_location: true`) and the
 * distance to the nearest few it doesn't fall inside.
 *
 * Disaster mode → impact zones, blocked roads, responder staging.
 * World Cup mode → stadium perimeter, fan zones, transit nodes, etc.
 */

import { z } from "zod";
import type {
  EventZoneLookupData,
  ToolExecutionSource,
} from "@/lib/ai/toolResults";
import { geocodeLocation } from "@/lib/tools/geocodeLocation";
import { EVENT_ZONES } from "./_mockGeo";
import { haversineMeters } from "./_haversine";

const coordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const eventZoneLookupArgsSchema = z.object({
  /**
   * Optional when `location_text` is provided. If omitted, we will try to
   * resolve `location_text` via the mock geocoder to get coordinates.
   */
  coordinates: coordinatesSchema.optional().nullable(),
  /** Optional when `coordinates` is provided. */
  location_text: z.string().trim().min(1).optional().nullable(),
  mode: z.enum(["disaster", "world_cup"]),
  max_results: z.number().int().min(1).max(20).optional(),
});

export type EventZoneLookupArgs = z.infer<typeof eventZoneLookupArgsSchema>;

export type EventZoneLookupOutput = {
  data: EventZoneLookupData;
  source: ToolExecutionSource;
};

const bboxCenter = (
  bbox: [number, number, number, number]
): { lat: number; lng: number } => ({
  lat: (bbox[0] + bbox[2]) / 2,
  lng: (bbox[1] + bbox[3]) / 2,
});

const bboxContains = (
  bbox: [number, number, number, number],
  point: { lat: number; lng: number }
): boolean =>
  point.lat >= bbox[0] &&
  point.lat <= bbox[2] &&
  point.lng >= bbox[1] &&
  point.lng <= bbox[3];

export const eventZoneLookup = async (
  args: EventZoneLookupArgs
): Promise<EventZoneLookupOutput> => {
  const limit = args.max_results ?? 6;
  let source: ToolExecutionSource = "static_context";

  const geocodeOutput =
    !args.coordinates && args.location_text
      ? await geocodeLocation({
          location_text: args.location_text,
          city_context: null,
          country_context: null,
        })
      : null;

  const resolvedCoordinates = args.coordinates ?? geocodeOutput?.data.coordinates ?? null;

  if (!resolvedCoordinates) {
    return {
      data: { matches: [] },
      source: "manual",
    };
  }

  if (!args.coordinates && args.location_text) {
    // If we had to geocode, the overall tool's source should reflect the
    // coordinate provenance rather than the static zone list.
    source = geocodeOutput?.source ?? "mock";
  }

  const matches = EVENT_ZONES.filter((zone) => zone.modes.includes(args.mode))
    .map((zone) => {
      const contains = bboxContains(zone.bbox, resolvedCoordinates);
      const center = bboxCenter(zone.bbox);
      const distance_meters = contains
        ? 0
        : haversineMeters(resolvedCoordinates, center);
      return {
        layer_id: zone.layer_id,
        name: zone.name,
        layer_type: zone.layer_type,
        contains_location: contains,
        distance_meters,
        metadata: zone.metadata,
      };
    })
    .sort((a, b) => {
      if (a.contains_location !== b.contains_location) {
        return a.contains_location ? -1 : 1;
      }
      return (a.distance_meters ?? 0) - (b.distance_meters ?? 0);
    })
    .slice(0, limit);

  return {
    data: { matches },
    source,
  };
};
