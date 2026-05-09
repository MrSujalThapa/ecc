"use client";

import { useEffect, type RefObject } from "react";
import mapboxgl from "mapbox-gl";
import type { Incident } from "@/lib/types";
import { incidentsToHeatmapFeatureCollection } from "@/lib/map/geojson";
import { mapboxLayerIds } from "@/lib/map/layers";
import {
  safelyRemoveLayer,
  safelyRemoveSource,
} from "@/lib/map/mapboxLifecycle";

type HeatmapLayerProps = {
  mapRef: RefObject<mapboxgl.Map | null>;
  mapReady: boolean;
  incidents: Incident[];
  visible: boolean;
};

function asMapboxGeoJson(data: ReturnType<typeof incidentsToHeatmapFeatureCollection>) {
  return data as Parameters<mapboxgl.GeoJSONSource["setData"]>[0];
}

export function HeatmapLayer({
  mapRef,
  mapReady,
  incidents,
  visible,
}: HeatmapLayerProps) {
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const data = incidentsToHeatmapFeatureCollection(incidents);
    const source = map.getSource(mapboxLayerIds.heatmapSource);

    if (!source) {
      map.addSource(mapboxLayerIds.heatmapSource, {
        type: "geojson",
        data: asMapboxGeoJson(data),
      });
    } else {
      (source as mapboxgl.GeoJSONSource).setData(asMapboxGeoJson(data));
    }

    if (!map.getLayer(mapboxLayerIds.heatmapLayer)) {
      map.addLayer({
        id: mapboxLayerIds.heatmapLayer,
        type: "heatmap",
        source: mapboxLayerIds.heatmapSource,
        maxzoom: 16,
        paint: {
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["get", "intensity"],
            0,
            0,
            1,
            1,
          ],
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            0.7,
            15,
            1.8,
          ],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(14, 165, 233, 0)",
            0.25,
            "rgba(56, 189, 248, 0.45)",
            0.5,
            "rgba(251, 191, 36, 0.65)",
            0.75,
            "rgba(249, 115, 22, 0.8)",
            1,
            "rgba(239, 68, 68, 0.95)",
          ],
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            18,
            15,
            42,
          ],
          "heatmap-opacity": visible ? 0.82 : 0,
        },
        layout: {
          visibility: visible ? "visible" : "none",
        },
      } as mapboxgl.AnyLayer);
    } else {
      map.setLayoutProperty(
        mapboxLayerIds.heatmapLayer,
        "visibility",
        visible ? "visible" : "none",
      );
    }

    return () => {
      safelyRemoveLayer(map, mapboxLayerIds.heatmapLayer);
      safelyRemoveSource(map, mapboxLayerIds.heatmapSource);
    };
  }, [incidents, mapReady, mapRef, visible]);

  return null;
}
