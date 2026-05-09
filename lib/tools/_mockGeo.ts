/**
 * Static seed data shared by mock tool executors.
 *
 * Keeps `geocodeLocation` and `eventZoneLookup` consistent (so a caller
 * geocoded near "BMO Field" matches the expected world-cup geography).
 */

import type { Coordinates, EventZoneLayerType } from "@/lib/ai/toolResults";
import { disasterSimImpactEventZoneSeeds } from "@/lib/mock/simulate-seed-geometry";

export const TORONTO_CENTER: Coordinates = { lat: 43.6532, lng: -79.3832 };

export type LandmarkSeed = {
  /** Lowercase fragments matched against incoming `location_text`. */
  match: string[];
  normalized_location: string;
  coordinates: Coordinates;
  confidence: number;
  provider_place_id: string;
};

/**
 * Curated Toronto landmarks that map cleanly to disaster / world-cup demo
 * scenarios in `lib/server/simulate-seed-enrichment.ts`.
 */
export const LANDMARKS: readonly LandmarkSeed[] = [
  {
    match: ["bmo field", "stadium", "exhibition place", "exhibition grounds"],
    normalized_location: "BMO Field, Exhibition Place, Toronto",
    coordinates: { lat: 43.6328, lng: -79.4187 },
    confidence: 0.95,
    provider_place_id: "mock:bmo_field",
  },
  {
    match: ["union station", "go bus", "go train", "union"],
    normalized_location: "Union Station, Toronto",
    coordinates: { lat: 43.6453, lng: -79.3806 },
    confidence: 0.95,
    provider_place_id: "mock:union_station",
  },
  {
    match: ["king street", "king st", "king west", "hotel row"],
    normalized_location: "King Street West, Toronto",
    coordinates: { lat: 43.6448, lng: -79.3955 },
    confidence: 0.82,
    provider_place_id: "mock:king_west",
  },
  {
    match: ["bloor", "spadina", "bloor and spadina", "bloor & spadina"],
    normalized_location: "Bloor & Spadina, Toronto",
    coordinates: { lat: 43.667, lng: -79.4028 },
    confidence: 0.9,
    provider_place_id: "mock:bloor_spadina",
  },
  {
    match: ["financial district", "bay street", "bay st"],
    normalized_location: "Financial District, Toronto",
    coordinates: { lat: 43.6481, lng: -79.3795 },
    confidence: 0.88,
    provider_place_id: "mock:financial_district",
  },
  {
    match: ["dundas and keele", "dundas & keele", "dundas keele", "west end"],
    normalized_location: "Dundas & Keele, Toronto",
    coordinates: { lat: 43.6657, lng: -79.4658 },
    confidence: 0.85,
    provider_place_id: "mock:dundas_keele",
  },
  {
    match: ["dana porter", "uw library", "waterloo library"],
    normalized_location: "Dana Porter Library, University of Waterloo",
    coordinates: { lat: 43.4699, lng: -80.5424 },
    confidence: 0.92,
    provider_place_id: "mock:dana_porter",
  },
  {
    match: ["fan zone", "fan festival", "east stage"],
    normalized_location: "Fan Festival East Stage, Exhibition Grounds",
    coordinates: { lat: 43.6346, lng: -79.4151 },
    confidence: 0.78,
    provider_place_id: "mock:fan_zone_east",
  },
];

// --- Event zones (rectangles for fast point-in-bbox checks) ----------------

export type EventZoneSeed = {
  layer_id: string;
  name: string;
  layer_type: EventZoneLayerType;
  /** Inclusive bbox: [minLat, minLng, maxLat, maxLng]. */
  bbox: [number, number, number, number];
  metadata: Record<string, unknown>;
  /** Modes in which this zone is exposed by `event_zone_lookup`. */
  modes: ReadonlyArray<"disaster" | "world_cup">;
};

export const EVENT_ZONES: readonly EventZoneSeed[] = [
  // World Cup geography
  {
    layer_id: "wc-stadium-perimeter",
    name: "BMO Field Stadium Perimeter",
    layer_type: "stadium_perimeter",
    bbox: [43.6308, -79.4215, 43.6348, -79.4159],
    metadata: { capacity: 30000 },
    modes: ["world_cup"],
  },
  {
    layer_id: "wc-fan-zone-east",
    name: "Fan Zone East",
    layer_type: "fan_zone",
    bbox: [43.6332, -79.4172, 43.6362, -79.4128],
    metadata: { stage: "east" },
    modes: ["world_cup"],
  },
  {
    layer_id: "wc-crowd-zone-north",
    name: "North Plaza Crowd Density Zone",
    layer_type: "crowd_density_zone",
    bbox: [43.6342, -79.4203, 43.6371, -79.4163],
    metadata: { peak_density: "high" },
    modes: ["world_cup"],
  },
  {
    layer_id: "wc-transit-union",
    name: "Union Station Transit Node",
    layer_type: "transit_node",
    bbox: [43.644, -79.382, 43.6466, -79.3792],
    metadata: { lines: ["GO", "TTC", "UP Express"] },
    modes: ["world_cup"],
  },
  {
    layer_id: "wc-restricted-vehicle-king",
    name: "King West Restricted Vehicle Zone",
    layer_type: "restricted_vehicle_zone",
    bbox: [43.643, -79.4, 43.6465, -79.39],
    metadata: { hours: "18:00–02:00" },
    modes: ["world_cup"],
  },
  // Disaster geography (impact zones = envelopes of `/api/simulate/disaster` seed coords)
  ...disasterSimImpactEventZoneSeeds(),
  {
    layer_id: "ds-blocked-road-financial",
    name: "Bay Street Closure",
    layer_type: "blocked_road",
    bbox: [43.6465, -79.3812, 43.6498, -79.3778],
    metadata: { reason: "structural assessment" },
    modes: ["disaster"],
  },
  {
    layer_id: "ds-staging-exhibition",
    name: "Exhibition Place Responder Staging",
    layer_type: "responder_staging_area",
    bbox: [43.6315, -79.421, 43.6348, -79.4172],
    metadata: { units_capacity: 12 },
    modes: ["disaster"],
  },
];

/**
 * GeoJSON positions use [lng, lat]. `EventZoneSeed.bbox` is
 * `[minLat, minLng, maxLat, maxLng]` (same convention as `eventZoneLookup`).
 */
export const seedBboxToPolygonRingLngLat = (
  bbox: [number, number, number, number],
): [number, number][] => {
  const [minLat, minLng, maxLat, maxLng] = bbox;
  return [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat],
  ];
};

/** Center longitude, full latitude span — fits N–S closure boxes like Bay St. */
export const seedBboxToBlockedRoadLineLngLat = (
  bbox: [number, number, number, number],
): [number, number][] => {
  const [minLat, minLng, maxLat, maxLng] = bbox;
  const midLng = (minLng + maxLng) / 2;
  return [
    [midLng, minLat],
    [midLng, maxLat],
  ];
};

/**
 * Deterministic jitter so unknown geocode text still produces a stable pin.
 * Key is the lowercased text; output stays inside ~1.5 km of TORONTO_CENTER.
 */
export const deterministicJitter = (key: string): Coordinates => {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const normalized = (hash >>> 0) / 0xffffffff;
  const angle = normalized * Math.PI * 2;
  const radius = 0.005 + ((hash >>> 8) & 0xff) / 0xff / 200;
  return {
    lat: Number((TORONTO_CENTER.lat + Math.cos(angle) * radius).toFixed(5)),
    lng: Number((TORONTO_CENTER.lng + Math.sin(angle) * radius).toFixed(5)),
  };
};
