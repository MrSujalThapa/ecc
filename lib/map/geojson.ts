import type { EventLayer, Incident, SurgeCluster } from "@/lib/types";

export type PointFeatureProperties = Record<string, string | number | boolean | null>;

export type PointFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: PointFeatureProperties;
};

export type GeoJsonFeature = PointFeature | {
  type: "Feature";
  geometry: Record<string, unknown>;
  properties: Record<string, unknown>;
};

export type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

export const emptyFeatureCollection: GeoJsonFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export function isValidCoordinates(coordinates: Incident["coordinates"]) {
  return (
    coordinates !== null &&
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lng) &&
    coordinates.lat >= -90 &&
    coordinates.lat <= 90 &&
    coordinates.lng >= -180 &&
    coordinates.lng <= 180
  );
}

export function incidentsToHeatmapFeatureCollection(
  incidents: Incident[],
): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: incidents
      .filter((incident) => isValidCoordinates(incident.coordinates))
      .map((incident) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [incident.coordinates!.lng, incident.coordinates!.lat],
        },
        properties: {
          id: incident.id,
          mode: incident.mode,
          urgency: incident.urgency,
          intensity:
            incident.urgency === "critical"
              ? 1
              : incident.urgency === "urgent"
                ? 0.75
                : 0.45,
          priority_score: incident.priority_score ?? 0,
        },
      })),
  };
}

export function clustersToFeatureCollection(
  clusters: SurgeCluster[],
  selectedClusterId: string | null = null,
): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: clusters
      .filter((cluster) => isValidCoordinates(cluster.center ?? null))
      .map((cluster) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [cluster.center!.lng, cluster.center!.lat],
        },
        properties: {
          id: cluster.cluster_id,
          title: cluster.title,
          incident_count: cluster.incident_count,
          critical_count: cluster.urgency_breakdown.critical ?? 0,
          urgent_count: cluster.urgency_breakdown.urgent ?? 0,
          selected: cluster.cluster_id === selectedClusterId,
        },
      })),
  };
}

export function eventLayersToFeatureCollection(
  layers: EventLayer[],
): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: layers.map((layer) => ({
      type: "Feature",
      geometry: layer.geometry,
      properties: {
        id: layer.id,
        mode: layer.mode,
        layer_type: layer.layer_type,
        name: layer.name,
        ...layer.metadata,
      },
    })),
  };
}
