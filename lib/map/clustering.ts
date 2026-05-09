import type { Incident, SurgeCluster, Urgency } from "@/lib/types";
import { mockSurgeClusters } from "@/lib/mock/clusters";
import { isValidCoordinates } from "@/lib/map/geojson";

const GRID_SIZE_DEGREES = 0.02;

type ClusterAccumulator = {
  incidentIds: string[];
  urgencyBreakdown: Partial<Record<Urgency, number>>;
  latTotal: number;
  lngTotal: number;
  priorityTotal: number;
};

/** Map-derived cluster that contains this incident (via `incident_ids`), if any. */
export function findSurgeClusterForIncident(
  incident: Incident,
  clusters: readonly SurgeCluster[],
): SurgeCluster | null {
  return clusters.find((c) => c.incident_ids.includes(incident.id)) ?? null;
}

export function getClusterIncidentIds(cluster: SurgeCluster) {
  return new Set(cluster.incident_ids);
}

export function getClusterIncidents(cluster: SurgeCluster, incidents: Incident[]) {
  const clusterIncidentIds = getClusterIncidentIds(cluster);
  return incidents.filter((incident) => clusterIncidentIds.has(incident.id));
}

export function getClusterMode(cluster: SurgeCluster, incidents: Incident[]) {
  const clusterIncidents = getClusterIncidents(cluster, incidents);
  const modes = new Set(clusterIncidents.map((incident) => incident.mode));

  if (modes.size === 1) {
    return clusterIncidents[0]?.mode ?? "unknown";
  }

  if (modes.size > 1) {
    return "mixed";
  }

  return "unknown";
}

export function getClusterPriorityScore(
  cluster: SurgeCluster,
  incidents: Incident[],
) {
  const scores = getClusterIncidents(cluster, incidents)
    .map((incident) => incident.priority_score)
    .filter((score): score is number => typeof score === "number");

  if (scores.length === 0) {
    return null;
  }

  return Math.max(...scores);
}

function distanceMeters(
  a: NonNullable<Incident["coordinates"]>,
  b: NonNullable<Incident["coordinates"]>,
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const firstLat = toRadians(a.lat);
  const secondLat = toRadians(b.lat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(lngDelta / 2) ** 2;

  return (
    2 *
    earthRadiusMeters *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function estimateClusterRadiusMeters(
  cluster: SurgeCluster,
  incidents: Incident[],
) {
  if (!cluster.center) {
    return null;
  }

  const distances = getClusterIncidents(cluster, incidents)
    .filter((incident) => isValidCoordinates(incident.coordinates))
    .map((incident) => distanceMeters(cluster.center!, incident.coordinates!));

  if (distances.length === 0) {
    return null;
  }

  return Math.max(150, Math.round(Math.max(...distances)));
}

export function deriveSurgeClusters(incidents: Incident[]): SurgeCluster[] {
  const grouped = new Map<string, ClusterAccumulator>();

  incidents
    .filter((incident) => isValidCoordinates(incident.coordinates))
    .forEach((incident) => {
      const coordinates = incident.coordinates!;
      const key = incident.cluster_id ?? [
        Math.round(coordinates.lat / GRID_SIZE_DEGREES),
        Math.round(coordinates.lng / GRID_SIZE_DEGREES),
      ].join(":");
      const current = grouped.get(key) ?? {
        incidentIds: [],
        urgencyBreakdown: {},
        latTotal: 0,
        lngTotal: 0,
        priorityTotal: 0,
      };

      current.incidentIds.push(incident.id);
      current.urgencyBreakdown[incident.urgency] =
        (current.urgencyBreakdown[incident.urgency] ?? 0) + 1;
      current.latTotal += coordinates.lat;
      current.lngTotal += coordinates.lng;
      current.priorityTotal += incident.priority_score ?? 0;
      grouped.set(key, current);
    });

  return Array.from(grouped.entries()).map(([key, cluster]) => ({
    cluster_id: `local-${key}`,
    title: "Local incident cluster",
    incident_count: cluster.incidentIds.length,
    urgency_breakdown: cluster.urgencyBreakdown,
    summary: `${cluster.incidentIds.length} visible incidents grouped locally.`,
    top_recommended_action:
      cluster.priorityTotal > 0
        ? "Prioritize highest-score incidents in this area."
        : null,
    incident_ids: cluster.incidentIds,
    center: {
      lat: cluster.latTotal / cluster.incidentIds.length,
      lng: cluster.lngTotal / cluster.incidentIds.length,
    },
  }));
}

export function getDisplaySurgeClusters(incidents: Incident[]): SurgeCluster[] {
  const derivedClusters = deriveSurgeClusters(incidents);
  return derivedClusters.length > 0 || incidents.length === 0
    ? derivedClusters
    : mockSurgeClusters;
}
