import type { Responder } from "@/lib/types";

export type MapLayerId =
  | "incidents"
  | "responders"
  | "heatmap"
  | "clusters"
  | "disasterZones"
  | "blockedRoads"
  | "eventLayers"
  | "routeLines";

export type MapLayerVisibility = Record<MapLayerId, boolean>;

export const defaultMapLayerVisibility: MapLayerVisibility = {
  incidents: true,
  responders: true,
  heatmap: false,
  /** Incident cluster circles — core layer (normal + disaster modes). */
  clusters: true,
  disasterZones: false,
  blockedRoads: false,
  eventLayers: false,
  routeLines: false,
};

/** Disaster / surge-only overlays; excludes incident clusters (see core). */
export const disasterMapLayerIds: MapLayerId[] = [
  "heatmap",
  "disasterZones",
  "blockedRoads",
];

export const mapLayerLabels: Record<MapLayerId, string> = {
  incidents: "Incidents",
  responders: "Responders",
  heatmap: "Heatmap",
  clusters: "Clusters",
  disasterZones: "Disaster zones",
  blockedRoads: "Blocked roads",
  eventLayers: "Event layers",
  routeLines: "Route lines",
};

const responderTypeClasses: Record<string, string> = {
  ambulance: "border-emerald-200 bg-emerald-400 text-emerald-950",
  fire: "border-red-200 bg-red-500 text-red-950",
  police: "border-sky-200 bg-sky-500 text-sky-950",
  event_staff: "border-violet-200 bg-violet-400 text-violet-950",
};

const responderTypeLabels: Record<string, string> = {
  ambulance: "Ambulance",
  fire: "Fire",
  police: "Police",
  event_staff: "Event staff",
};

export function responderMarkerClass(responder: Responder) {
  return (
    responderTypeClasses[responder.type] ??
    "border-slate-200 bg-slate-400 text-slate-950"
  );
}

export function formatResponderType(type: string) {
  return responderTypeLabels[type] ?? type.replaceAll("_", " ");
}

export const mapboxLayerIds = {
  heatmapSource: "dashboard-disaster-heatmap-source",
  heatmapLayer: "dashboard-disaster-heatmap",
  clusterSource: "dashboard-disaster-clusters-source",
  clusterCircleLayer: "dashboard-disaster-cluster-circles",
  clusterLabelLayer: "dashboard-disaster-cluster-labels",
  impactZoneSource: "dashboard-disaster-zones-source",
  impactZoneFillLayer: "dashboard-disaster-zones-fill",
  impactZoneLineLayer: "dashboard-disaster-zones-outline",
  blockedRoadSource: "dashboard-blocked-roads-source",
  blockedRoadLineLayer: "dashboard-blocked-roads-line",
  blockedRoadLabelLayer: "dashboard-blocked-roads-labels",
  worldCupEventSource: "dashboard-world-cup-event-source",
  worldCupZoneFillLayer: "dashboard-world-cup-zones-fill",
  worldCupZoneOutlineLayer: "dashboard-world-cup-zones-outline",
  worldCupStadiumFillLayer: "dashboard-world-cup-stadium-fill",
  worldCupStadiumOutlineLayer: "dashboard-world-cup-stadium-outline",
  worldCupRoadClosureLineLayer: "dashboard-world-cup-road-closures-line",
  worldCupRoadClosureLabelLayer: "dashboard-world-cup-road-closures-labels",
  worldCupPointsLayer: "dashboard-world-cup-points",
  worldCupPointsLabelLayer: "dashboard-world-cup-point-labels",
} as const;
