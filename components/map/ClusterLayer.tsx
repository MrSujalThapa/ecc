"use client";

import { useEffect, type RefObject } from "react";
import mapboxgl from "mapbox-gl";
import type { SurgeCluster } from "@/lib/types";
import { clustersToFeatureCollection } from "@/lib/map/geojson";
import { mapboxLayerIds } from "@/lib/map/layers";
import {
  safelyRemoveLayer,
  safelyRemoveSource,
} from "@/lib/map/mapboxLifecycle";

type ClusterLayerProps = {
  mapRef: RefObject<mapboxgl.Map | null>;
  mapReady: boolean;
  clusters: SurgeCluster[];
  selectedClusterId: string | null;
  visible: boolean;
  onSelectCluster: (clusterId: string) => void;
};

function asMapboxGeoJson(data: ReturnType<typeof clustersToFeatureCollection>) {
  return data as Parameters<mapboxgl.GeoJSONSource["setData"]>[0];
}

export function ClusterLayer({
  mapRef,
  mapReady,
  clusters,
  selectedClusterId,
  visible,
  onSelectCluster,
}: ClusterLayerProps) {
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const data = clustersToFeatureCollection(clusters, selectedClusterId);
    const source = map.getSource(mapboxLayerIds.clusterSource);

    if (!source) {
      map.addSource(mapboxLayerIds.clusterSource, {
        type: "geojson",
        data: asMapboxGeoJson(data),
      });
    } else {
      (source as mapboxgl.GeoJSONSource).setData(asMapboxGeoJson(data));
    }

    if (!map.getLayer(mapboxLayerIds.clusterCircleLayer)) {
      map.addLayer({
        id: mapboxLayerIds.clusterCircleLayer,
        type: "circle",
        source: mapboxLayerIds.clusterSource,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "incident_count"],
            1,
            18,
            8,
            34,
          ],
          "circle-color": [
            "case",
            ["boolean", ["get", "selected"], false],
            "rgba(34, 211, 238, 0.9)",
            [">", ["get", "critical_count"], 0],
            "rgba(239, 68, 68, 0.7)",
            "rgba(249, 115, 22, 0.65)",
          ],
          "circle-stroke-color": [
            "case",
            ["boolean", ["get", "selected"], false],
            "#ecfeff",
            "#f8fafc",
          ],
          "circle-stroke-width": [
            "case",
            ["boolean", ["get", "selected"], false],
            4,
            2,
          ],
          "circle-opacity": 0.82,
        },
        layout: {
          visibility: visible ? "visible" : "none",
        },
      } as mapboxgl.AnyLayer);
    } else {
      map.setLayoutProperty(
        mapboxLayerIds.clusterCircleLayer,
        "visibility",
        visible ? "visible" : "none",
      );
    }

    if (!map.getLayer(mapboxLayerIds.clusterLabelLayer)) {
      map.addLayer({
        id: mapboxLayerIds.clusterLabelLayer,
        type: "symbol",
        source: mapboxLayerIds.clusterSource,
        layout: {
          "text-field": ["to-string", ["get", "incident_count"]],
          "text-size": 12,
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          visibility: visible ? "visible" : "none",
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#f8fafc",
          "text-halo-width": 1,
        },
      } as mapboxgl.AnyLayer);
    } else {
      map.setLayoutProperty(
        mapboxLayerIds.clusterLabelLayer,
        "visibility",
        visible ? "visible" : "none",
      );
    }

    const handleClusterClick = (event: mapboxgl.MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(event.point, {
        layers: [mapboxLayerIds.clusterCircleLayer],
      })[0];
      const clusterId = feature?.properties?.id;

      if (typeof clusterId === "string") {
        onSelectCluster(clusterId);
      }
    };
    const handleClusterMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const handleClusterMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    if (visible) {
      map.on("click", mapboxLayerIds.clusterCircleLayer, handleClusterClick);
      map.on("mouseenter", mapboxLayerIds.clusterCircleLayer, handleClusterMouseEnter);
      map.on("mouseleave", mapboxLayerIds.clusterCircleLayer, handleClusterMouseLeave);
    }

    return () => {
      try {
        map.off("click", mapboxLayerIds.clusterCircleLayer, handleClusterClick);
        map.off(
          "mouseenter",
          mapboxLayerIds.clusterCircleLayer,
          handleClusterMouseEnter,
        );
        map.off(
          "mouseleave",
          mapboxLayerIds.clusterCircleLayer,
          handleClusterMouseLeave,
        );
        map.getCanvas().style.cursor = "";
      } catch {
        // Mapbox may already have torn down internal listeners during unmount.
      }
      safelyRemoveLayer(map, mapboxLayerIds.clusterLabelLayer);
      safelyRemoveLayer(map, mapboxLayerIds.clusterCircleLayer);
      safelyRemoveSource(map, mapboxLayerIds.clusterSource);
    };
  }, [clusters, mapReady, mapRef, onSelectCluster, selectedClusterId, visible]);

  return null;
}
