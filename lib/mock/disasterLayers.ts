import type { EventLayer } from "@/lib/types";
import type { Json } from "@/lib/types/json";
import {
  EVENT_ZONES,
  seedBboxToBlockedRoadLineLngLat,
  seedBboxToPolygonRingLngLat,
} from "@/lib/tools/_mockGeo";

const disasterSeeds = EVENT_ZONES.filter((z) => z.modes.includes("disaster"));

const asLayerMetadata = (metadata: Record<string, unknown>): Record<string, Json> =>
  metadata as Record<string, Json>;

/** Impact polygons aligned with `EVENT_ZONES` / `event_zone_lookup` (disaster). */
export const disasterImpactZones: EventLayer[] = disasterSeeds
  .filter((z) => z.layer_type === "impact_zone")
  .map((z) => ({
    id: z.layer_id,
    mode: "disaster",
    layer_type: z.layer_type,
    name: z.name,
    geometry: {
      type: "Polygon",
      coordinates: [seedBboxToPolygonRingLngLat(z.bbox)],
    },
    metadata: asLayerMetadata(z.metadata),
  }));

/** Line geometry aligned with disaster `blocked_road` seeds in `EVENT_ZONES`. */
export const blockedRoadLayers: EventLayer[] = disasterSeeds
  .filter((z) => z.layer_type === "blocked_road")
  .map((z) => ({
    id: z.layer_id,
    mode: "disaster",
    layer_type: z.layer_type,
    name: z.name,
    geometry: {
      type: "LineString",
      coordinates: seedBboxToBlockedRoadLineLngLat(z.bbox),
    },
    metadata: {
      ...asLayerMetadata(z.metadata),
      status: "closed",
    },
  }));
