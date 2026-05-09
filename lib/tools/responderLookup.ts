/**
 * Mock responder lookup. Takes incident coordinates and returns the closest
 * available responders ranked by Haversine distance, optionally filtered by
 * type (ambulance / fire / police / event_staff).
 *
 * Powered by `getMockResponders()` so the same fake fleet shown on the map
 * is what the AI reasons over.
 */

import { z } from "zod";
import { getMockResponders } from "@/lib/server/responders-mock-data";
import type {
  ResponderLookupData,
  ToolExecutionSource,
} from "@/lib/ai/toolResults";
import { haversineMeters } from "./_haversine";

const coordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const responderLookupArgsSchema = z.object({
  incident_coordinates: coordinatesSchema,
  incident_id: z.string().optional().nullable(),
  responder_types: z.array(z.string().min(1)).optional(),
  max_results: z.number().int().min(1).max(20).optional(),
});

export type ResponderLookupArgs = z.infer<typeof responderLookupArgsSchema>;

export type ResponderLookupOutput = {
  data: ResponderLookupData;
  source: ToolExecutionSource;
};

const distanceReason = (distance_meters: number, type: string): string => {
  const km = (distance_meters / 1000).toFixed(2);
  return `Closest available ${type} unit, ~${km} km from incident.`;
};

export const responderLookup = async (
  args: ResponderLookupArgs
): Promise<ResponderLookupOutput> => {
  const responders = getMockResponders();
  const allowedTypes = args.responder_types
    ? new Set(args.responder_types.map((t) => t.toLowerCase()))
    : null;
  const limit = args.max_results ?? 3;

  const ranked = responders
    .filter((responder) => {
      if (allowedTypes && !allowedTypes.has(responder.type.toLowerCase())) {
        return false;
      }
      return responder.status !== "offline";
    })
    .map((responder) => {
      const distance_meters = haversineMeters(
        args.incident_coordinates,
        responder.coordinates
      );
      return {
        responder_id: responder.id,
        display_name: responder.display_name,
        type: responder.type,
        status: responder.status,
        coordinates: responder.coordinates,
        distance_meters,
        reason: distanceReason(distance_meters, responder.type),
      };
    })
    .sort((a, b) => a.distance_meters - b.distance_meters)
    .slice(0, limit);

  return {
    data: { recommendations: ranked },
    source: "database",
  };
};
