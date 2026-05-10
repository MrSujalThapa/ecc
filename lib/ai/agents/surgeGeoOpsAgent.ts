/**
 * Surge / GeoOps agent (`project_details.md` §6.2).
 *
 * `RunSurgeGeoOpsAgentInput.provider` is populated by
 * `lib/surge/buildSurgeGeoOpsAgentInput.ts` (`GEOOPS_PROVIDER` ?? `AI_PROVIDER`).
 * The deterministic path below remains the default until Member 3 wires a
 * validated model + optional tool loop.
 */

import {
  validateSurgeGeoOpsAgentOutput,
  type Coordinates,
  type EventZoneMatch,
  type GeoOpsRecommendation,
  type HelpPointRecommendation,
  type ResponderRecommendation,
  type RouteRecommendation,
  type SurgeCluster,
  type SurgeGeoOpsAgentOutput,
} from "../schemas/surgeGeoOpsAgentOutputSchema";

export type SurgeGeoOpsMode = "disaster" | "world_cup";

export type RunSurgeGeoOpsAgentInput = {
  mode: SurgeGeoOpsMode;
  activeIncidents: Array<Record<string, unknown>>;
  responders?: Array<Record<string, unknown>>;
  eventLayers?: Array<Record<string, unknown>>;
  recentToolResults?: unknown[];
  provider?: "mock" | "featherless" | string | null;
};

type IncidentWithId = Record<string, unknown> & {
  id: string;
};

type Urgency = "unknown" | "non_emergency" | "urgent" | "critical";

const URGENCY_RANK: Record<Urgency, number> = {
  critical: 4,
  urgent: 3,
  non_emergency: 2,
  unknown: 1,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asCoordinates(value: unknown): Coordinates | null {
  const record = asRecord(value);
  if (!record) return null;

  const lat = asNumber(record.lat);
  const lng = asNumber(record.lng);
  if (lat === null || lng === null) return null;

  return { lat, lng };
}

function getIncidentId(
  incident: Record<string, unknown>,
  index: number
): string {
  return (
    asString(incident.id) ??
    asString(incident.public_id) ??
    asString(incident.incident_id) ??
    `incident-${index + 1}`
  );
}

function normalizeUrgency(value: unknown): Urgency {
  if (
    value === "critical" ||
    value === "urgent" ||
    value === "non_emergency" ||
    value === "unknown"
  ) {
    return value;
  }

  return "unknown";
}

function withIds(
  incidents: Array<Record<string, unknown>>
): IncidentWithId[] {
  return incidents.map((incident, index) => ({
    ...incident,
    id: getIncidentId(incident, index),
  }));
}

function getIncidentCoordinates(
  incident: Record<string, unknown>
): Coordinates | null {
  return asCoordinates(incident.coordinates);
}

function averageCoordinates(coordinates: Coordinates[]): Coordinates {
  const total = coordinates.reduce(
    (sum, point) => ({
      lat: sum.lat + point.lat,
      lng: sum.lng + point.lng,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: total.lat / coordinates.length,
    lng: total.lng / coordinates.length,
  };
}

function getClusterRadiusMeters(coordinates: Coordinates[]): number {
  if (coordinates.length <= 1) return 250;
  return Math.min(5000, Math.max(250, coordinates.length * 350));
}

function getUrgencyBreakdown(incidents: IncidentWithId[]) {
  return incidents.reduce(
    (breakdown, incident) => {
      const urgency = normalizeUrgency(incident.urgency);
      breakdown[urgency] += 1;
      return breakdown;
    },
    {
      unknown: 0,
      non_emergency: 0,
      urgent: 0,
      critical: 0,
    }
  );
}

function scoreCluster(incidents: IncidentWithId[]): number {
  const maxRank = incidents.reduce((max, incident) => {
    const urgency = normalizeUrgency(incident.urgency);
    return Math.max(max, URGENCY_RANK[urgency]);
  }, 1);
  const densityBoost = Math.min(0.25, incidents.length * 0.04);
  return Math.min(1, maxRank / 4 + densityBoost);
}

function topRecommendedAction(incidents: IncidentWithId[]): string | null {
  const breakdown = getUrgencyBreakdown(incidents);
  if (breakdown.critical > 0) {
    return "Prioritize operator review for critical incidents in this cluster.";
  }
  if (breakdown.urgent > 0) {
    return "Review urgent incidents and prepare operator follow-up.";
  }
  if (incidents.length > 0) {
    return "Monitor cluster and continue AI-assisted intake where appropriate.";
  }
  return null;
}

function buildCluster(
  mode: SurgeGeoOpsMode,
  clusterId: string,
  incidents: IncidentWithId[]
): SurgeCluster | null {
  const coordinates = incidents
    .map(getIncidentCoordinates)
    .filter((value): value is Coordinates => value !== null);

  if (coordinates.length === 0) return null;

  const breakdown = getUrgencyBreakdown(incidents);
  const center = averageCoordinates(coordinates);
  const priorityScore = scoreCluster(incidents);

  return {
    id: clusterId,
    mode,
    title:
      mode === "disaster"
        ? "Disaster incident cluster"
        : "World Cup incident cluster",
    summary: `${incidents.length} active incident${
      incidents.length === 1 ? "" : "s"
    } with ${breakdown.critical} critical and ${breakdown.urgent} urgent.`,
    center,
    radius_meters: getClusterRadiusMeters(coordinates),
    incident_ids: incidents.map((incident) => incident.id),
    incident_count: incidents.length,
    urgency_breakdown: breakdown,
    top_recommended_action: topRecommendedAction(incidents),
    priority_score: priorityScore,
  };
}

function buildClusters(
  mode: SurgeGeoOpsMode,
  incidents: IncidentWithId[]
): SurgeCluster[] {
  const grouped = new Map<string, IncidentWithId[]>();
  const withClusterId = incidents.filter((incident) => asString(incident.cluster_id));

  if (withClusterId.length > 0) {
    for (const incident of incidents) {
      const clusterId =
        asString(incident.cluster_id) ??
        `${mode}-unclustered-${incident.id}`;
      grouped.set(clusterId, [...(grouped.get(clusterId) ?? []), incident]);
    }
  } else {
    const withCoordinates = incidents.filter(
      (incident) => getIncidentCoordinates(incident) !== null
    );
    if (withCoordinates.length > 0) {
      grouped.set(`${mode}-active-incidents`, withCoordinates);
    }
  }

  return [...grouped.entries()]
    .map(([clusterId, clusterIncidents]) =>
      buildCluster(mode, clusterId, clusterIncidents)
    )
    .filter((cluster): cluster is SurgeCluster => cluster !== null);
}

function sortPriorityIncidentIds(incidents: IncidentWithId[]): string[] {
  return [...incidents]
    .sort((a, b) => {
      const urgencyDiff =
        URGENCY_RANK[normalizeUrgency(b.urgency)] -
        URGENCY_RANK[normalizeUrgency(a.urgency)];
      if (urgencyDiff !== 0) return urgencyDiff;
      return a.id.localeCompare(b.id);
    })
    .map((incident) => incident.id);
}

function buildGeoOpsRecommendations(
  clusters: SurgeCluster[]
): GeoOpsRecommendation[] {
  return clusters
    .filter(
      (cluster) =>
        cluster.urgency_breakdown.critical > 0 ||
        cluster.urgency_breakdown.urgent > 0
    )
    .map((cluster) => ({
      id: `rec-${cluster.id}`,
      type:
        cluster.urgency_breakdown.critical > 0
          ? "operator_focus"
          : "cluster_attention",
      title:
        cluster.urgency_breakdown.critical > 0
          ? "Operator focus recommended"
          : "Urgent cluster attention recommended",
      summary:
        cluster.top_recommended_action ??
        "Review this cluster for operator follow-up.",
      incident_ids: cluster.incident_ids,
      priority_score: cluster.priority_score,
      requires_operator_confirmation: true,
    }));
}

function extractRecordsFromToolResults(
  recentToolResults: unknown[],
  toolName: string,
  keys: string[]
): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];

  for (const value of recentToolResults) {
    const result = asRecord(value);
    if (!result || result.tool !== toolName || result.ok !== true) continue;
    const data = asRecord(result.data);
    if (!data) continue;

    for (const key of keys) {
      const candidate = data[key];
      if (Array.isArray(candidate)) {
        records.push(
          ...candidate.filter(
            (item): item is Record<string, unknown> => asRecord(item) !== null
          )
        );
      } else {
        const record = asRecord(candidate);
        if (record) records.push(record);
      }
    }
  }

  return records;
}

function toRouteRecommendation(
  value: Record<string, unknown>
): RouteRecommendation | null {
  const id = asString(value.id) ?? asString(value.route_id);
  const from = asCoordinates(value.from);
  const to = asCoordinates(value.to);
  const profile = value.profile;
  const distance = asNumber(value.distance_meters);
  const duration = asNumber(value.duration_seconds);
  const reason = asString(value.reason) ?? "Backend-provided route context.";
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];

  if (
    !id ||
    !from ||
    !to ||
    (profile !== "driving" && profile !== "walking" && profile !== "cycling") ||
    distance === null ||
    duration === null
  ) {
    return null;
  }

  return {
    id,
    from,
    to,
    profile,
    distance_meters: distance,
    duration_seconds: duration,
    geometry: value.geometry,
    reason,
    warnings,
  };
}

function toResponderRecommendation(
  value: Record<string, unknown>
): ResponderRecommendation | null {
  const responderId = asString(value.responder_id) ?? asString(value.id);
  const displayName =
    asString(value.display_name) ?? asString(value.name) ?? responderId;
  const coordinates = asCoordinates(value.coordinates);
  const distance = asNumber(value.distance_meters) ?? 0;
  const travelSeconds = asNumber(value.estimated_travel_seconds);
  const reason = asString(value.reason) ?? "Responder context was provided.";

  if (
    !responderId ||
    !displayName ||
    !coordinates ||
    (value.type !== "ambulance" &&
      value.type !== "fire" &&
      value.type !== "police" &&
      value.type !== "event_staff") ||
    (value.status !== "available" &&
      value.status !== "assigned" &&
      value.status !== "en_route" &&
      value.status !== "busy" &&
      value.status !== "offline")
  ) {
    return null;
  }

  return {
    responder_id: responderId,
    display_name: displayName,
    type: value.type,
    status: value.status,
    coordinates,
    distance_meters: distance,
    estimated_travel_seconds: travelSeconds,
    reason,
  };
}

function toHelpPointRecommendation(
  value: Record<string, unknown>
): HelpPointRecommendation | null {
  const id = asString(value.id);
  const name = asString(value.name);
  const coordinates = asCoordinates(value.coordinates);
  const distance = asNumber(value.distance_meters);
  const metadata = asRecord(value.metadata) ?? {};
  const type = value.type;

  if (
    !id ||
    !name ||
    !coordinates ||
    distance === null ||
    (type !== "medical_tent" &&
      type !== "police_tent" &&
      type !== "security_tent" &&
      type !== "lost_and_found" &&
      type !== "tourist_help" &&
      type !== "transit_node" &&
      type !== "shelter" &&
      type !== "mechanic_or_roadside_help")
  ) {
    return null;
  }

  return {
    id,
    type,
    name,
    coordinates,
    distance_meters: distance,
    route_summary: asString(value.route_summary),
    metadata,
  };
}

function toEventZoneMatch(value: Record<string, unknown>): EventZoneMatch | null {
  const layerId = asString(value.layer_id) ?? asString(value.id);
  const name = asString(value.name);
  const layerType = asString(value.layer_type) ?? asString(value.type);
  const metadata = asRecord(value.metadata) ?? {};

  if (!layerId || !name || !layerType) return null;

  return {
    layer_id: layerId,
    name,
    layer_type: layerType,
    distance_meters: asNumber(value.distance_meters),
    contains_location:
      typeof value.contains_location === "boolean"
        ? value.contains_location
        : false,
    metadata,
  };
}

function buildRouteRecommendations(
  recentToolResults: unknown[]
): RouteRecommendation[] {
  return extractRecordsFromToolResults(recentToolResults, "route_between_points", [
    "route",
    "routes",
  ])
    .map(toRouteRecommendation)
    .filter((route): route is RouteRecommendation => route !== null);
}

function buildResponderRecommendations(
  responders: Array<Record<string, unknown>>,
  recentToolResults: unknown[]
): ResponderRecommendation[] {
  const toolResponderRecords = extractRecordsFromToolResults(
    recentToolResults,
    "responder_lookup",
    ["recommendations", "responders"]
  );

  return [...responders, ...toolResponderRecords]
    .map(toResponderRecommendation)
    .filter(
      (responder): responder is ResponderRecommendation => responder !== null
    );
}

function buildHelpPointRecommendations(
  recentToolResults: unknown[]
): HelpPointRecommendation[] {
  return extractRecordsFromToolResults(
    recentToolResults,
    "nearest_help_point_lookup",
    ["recommendations", "help_points"]
  )
    .map(toHelpPointRecommendation)
    .filter((helpPoint): helpPoint is HelpPointRecommendation => helpPoint !== null);
}

function buildEventZoneMatches(
  eventLayers: Array<Record<string, unknown>>,
  recentToolResults: unknown[]
): EventZoneMatch[] {
  const toolEventRecords = extractRecordsFromToolResults(
    recentToolResults,
    "event_zone_lookup",
    ["matches", "event_layers"]
  );

  return [...eventLayers, ...toolEventRecords]
    .map(toEventZoneMatch)
    .filter((match): match is EventZoneMatch => match !== null);
}

function buildSummary(
  mode: SurgeGeoOpsMode,
  incidentCount: number,
  clusters: SurgeCluster[]
): string {
  if (incidentCount === 0) {
    return "No active incidents available for Surge / GeoOps analysis.";
  }

  const critical = clusters.reduce(
    (total, cluster) => total + cluster.urgency_breakdown.critical,
    0
  );
  const urgent = clusters.reduce(
    (total, cluster) => total + cluster.urgency_breakdown.urgent,
    0
  );

  return `${mode === "disaster" ? "Disaster" : "World Cup"} GeoOps summary: ${incidentCount} active incident${
    incidentCount === 1 ? "" : "s"
  }, ${clusters.length} cluster${clusters.length === 1 ? "" : "s"}, ${critical} critical, ${urgent} urgent.`;
}

export async function runSurgeGeoOpsAgent(
  input: RunSurgeGeoOpsAgentInput
): Promise<SurgeGeoOpsAgentOutput> {
  // `input.provider` is set for integration; model-backed GeoOps replaces this
  // deterministic implementation when ready (same public signature).
  void input.provider;

  const incidents = withIds(input.activeIncidents);
  const clusters = buildClusters(input.mode, incidents);
  const recentToolResults = input.recentToolResults ?? [];

  const output: SurgeGeoOpsAgentOutput = {
    schema_version: "1.0",
    mode: input.mode,
    clusters,
    top_priority_incident_ids: sortPriorityIncidentIds(incidents),
    route_recommendations: buildRouteRecommendations(recentToolResults),
    responder_recommendations: buildResponderRecommendations(
      input.responders ?? [],
      recentToolResults
    ),
    help_point_recommendations:
      buildHelpPointRecommendations(recentToolResults),
    event_zone_matches: buildEventZoneMatches(
      input.eventLayers ?? [],
      recentToolResults
    ),
    geoops_recommendations: buildGeoOpsRecommendations(clusters),
    summary: buildSummary(input.mode, incidents.length, clusters),
    confidence: incidents.length === 0 ? 0.8 : 0.72,
  };

  return validateSurgeGeoOpsAgentOutput(output);
}
