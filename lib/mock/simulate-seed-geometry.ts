/**
 * Shared Toronto anchor, jitter, and disaster slot offsets for:
 * - `mergeSimulatedSurgeRow` (`/api/simulate/disaster` | `world-cup`)
 * - disaster impact zone envelopes on the dashboard + `event_zone_lookup`
 *
 * `project_details.md` §9.2: Mapbox shows "impact zones" in disaster mode —
 * GeoOps-style overlays for affected geography (here: bounding regions that
 * contain the deterministic simulate seed coordinates per urgency band).
 */

import type { Urgency } from "@/lib/types/enums";

/** Same anchor historically used in `simulate-seed-enrichment` (downtown Toronto). */
export const SIMULATE_SEED_TORONTO_BASE = { lat: 43.6532, lng: -79.3832 } as const;

/** Ring jitter keyed by `seedIndex`; identical for disaster and world-cup sim rows. */
export const simulateSeedJitter = (seedIndex: number): { lat: number; lng: number } => {
  const ring = (seedIndex % 5) * 0.004;
  const angle = (seedIndex * 0.7) % (Math.PI * 2);
  return {
    lat: Math.cos(angle) * ring,
    lng: Math.sin(angle) * ring,
  };
};

/**
 * One entry per `DISASTER_SCENARIOS` row (same order). Only these fields are
 * shared with map / event-zone geometry; narrative fields stay in the server module.
 */
export const DISASTER_SIM_SEED_GEO_SLOTS: readonly {
  latOffset: number;
  lngOffset: number;
  urgency: Urgency;
}[] = [
  { latOffset: 0.015, lngOffset: -0.018, urgency: "critical" },
  { latOffset: -0.012, lngOffset: 0.022, urgency: "urgent" },
  { latOffset: 0.028, lngOffset: 0.01, urgency: "urgent" },
  { latOffset: -0.02, lngOffset: -0.025, urgency: "non_emergency" },
];

const disasterSlotCount = DISASTER_SIM_SEED_GEO_SLOTS.length;

/** Coordinates for `seedIndex` under disaster sim rotation (matches `mergeSimulatedSurgeRow`). */
export const coordinatesForDisasterSimSeedIndex = (
  seedIndex: number,
): { lat: number; lng: number } => {
  const slot = DISASTER_SIM_SEED_GEO_SLOTS[seedIndex % disasterSlotCount]!;
  const j = simulateSeedJitter(seedIndex);
  return {
    lat: Number((SIMULATE_SEED_TORONTO_BASE.lat + slot.latOffset + j.lat).toFixed(5)),
    lng: Number((SIMULATE_SEED_TORONTO_BASE.lng + slot.lngOffset + j.lng).toFixed(5)),
  };
};

type SimImpactBbox = [number, number, number, number];

/**
 * Axis-aligned bbox `[minLat, minLng, maxLat, maxLng]` covering all disaster
 * sim coordinates for `critical` vs `urgent` slots (over `seedIndex` sweep),
 * plus padding so pins stay inside the drawn polygon.
 */
export const disasterSimImpactZoneBboxes = (
  maxSeedIndex = 800,
  paddingDeg = 0.002,
): { critical: SimImpactBbox; urgent: SimImpactBbox } => {
  let cMinLat = Infinity;
  let cMaxLat = -Infinity;
  let cMinLng = Infinity;
  let cMaxLng = -Infinity;
  let uMinLat = Infinity;
  let uMaxLat = -Infinity;
  let uMinLng = Infinity;
  let uMaxLng = -Infinity;

  for (let seedIndex = 0; seedIndex < maxSeedIndex; seedIndex += 1) {
    const slot = DISASTER_SIM_SEED_GEO_SLOTS[seedIndex % disasterSlotCount]!;
    const { lat, lng } = coordinatesForDisasterSimSeedIndex(seedIndex);
    if (slot.urgency === "critical") {
      cMinLat = Math.min(cMinLat, lat);
      cMaxLat = Math.max(cMaxLat, lat);
      cMinLng = Math.min(cMinLng, lng);
      cMaxLng = Math.max(cMaxLng, lng);
    } else if (slot.urgency === "urgent") {
      uMinLat = Math.min(uMinLat, lat);
      uMaxLat = Math.max(uMaxLat, lat);
      uMinLng = Math.min(uMinLng, lng);
      uMaxLng = Math.max(uMaxLng, lng);
    }
  }

  return {
    critical: [
      cMinLat - paddingDeg,
      cMinLng - paddingDeg,
      cMaxLat + paddingDeg,
      cMaxLng + paddingDeg,
    ],
    urgent: [
      uMinLat - paddingDeg,
      uMinLng - paddingDeg,
      uMaxLat + paddingDeg,
      uMaxLng + paddingDeg,
    ],
  };
};

export const disasterSimImpactEventZoneSeeds = () => {
  const { critical, urgent } = disasterSimImpactZoneBboxes();
  return [
    {
      layer_id: "ds-impact-sim-critical",
      name: "Disaster simulation — critical footprint (structure fire / Bloor–Spadina)",
      layer_type: "impact_zone" as const,
      bbox: critical,
      metadata: {
        severity: "high",
        summary:
          "Bounds all `/api/simulate/disaster` critical-seed coordinates (rotating indices ≡ 0 mod 4).",
      },
      modes: ["disaster"] as const,
    },
    {
      layer_id: "ds-impact-sim-urgent",
      name: "Disaster simulation — urgent footprint (financial district + Exhibition surge)",
      layer_type: "impact_zone" as const,
      bbox: urgent,
      metadata: {
        severity: "medium",
        summary:
          "Bounds all disaster sim urgent-seed coordinates (earthquake + medical surge slots).",
      },
      modes: ["disaster"] as const,
    },
  ] as const;
};
