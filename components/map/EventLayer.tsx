"use client";

import { useEffect, type RefObject } from "react";
import mapboxgl from "mapbox-gl";
import type { AppMode, EventLayer as EventLayerType } from "@/lib/types";
import { worldCupEventLayers } from "@/lib/mock/worldCupLayers";
import { eventLayersToFeatureCollection } from "@/lib/map/geojson";
import { mapboxLayerIds } from "@/lib/map/layers";
import { safelyRemoveLayer, safelyRemoveSource } from "@/lib/map/mapboxLifecycle";

type EventLayerProps = {
  mapRef: RefObject<mapboxgl.Map | null>;
  mapReady: boolean;
  visible: boolean;
  mode: AppMode | "all";
  layers?: EventLayerType[];
};

function asMapboxGeoJson(
  data: ReturnType<typeof eventLayersToFeatureCollection>,
) {
  return data as Parameters<mapboxgl.GeoJSONSource["setData"]>[0];
}

function setLayerVisibility(map: mapboxgl.Map, layerId: string, visible: boolean) {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}

function getInsertBeforeLayerId(map: mapboxgl.Map) {
  const layers = map.getStyle().layers ?? [];
  const firstSymbol = layers.find((layer) => layer.type === "symbol");
  return firstSymbol?.id;
}

export function EventLayer({
  mapRef,
  mapReady,
  visible,
  mode,
  layers,
}: EventLayerProps) {
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const eventLayers = layers ?? worldCupEventLayers;
    const filteredLayers =
      mode === "all" ? eventLayers : eventLayers.filter((layer) => layer.mode === mode);

    const data = eventLayersToFeatureCollection(filteredLayers);
    const source = map.getSource(mapboxLayerIds.worldCupEventSource);

    if (!source) {
      map.addSource(mapboxLayerIds.worldCupEventSource, {
        type: "geojson",
        data: asMapboxGeoJson(data),
      });
    } else {
      (source as mapboxgl.GeoJSONSource).setData(asMapboxGeoJson(data));
    }

    const targetVisibility = visible ? "visible" : "none";
    const insertBefore = getInsertBeforeLayerId(map);

    if (!map.getLayer(mapboxLayerIds.worldCupZoneFillLayer)) {
      map.addLayer({
        id: mapboxLayerIds.worldCupZoneFillLayer,
        type: "fill",
        source: mapboxLayerIds.worldCupEventSource,
        filter: [
          "in",
          ["get", "layer_type"],
          ["literal", ["fan_zone", "restricted_vehicle_zone", "crowd_density_zone"]],
        ],
        paint: {
          "fill-color": [
            "match",
            ["get", "layer_type"],
            "fan_zone",
            "#22c55e",
            "restricted_vehicle_zone",
            "#f97316",
            "crowd_density_zone",
            "#a855f7",
            "#38bdf8",
          ],
          "fill-opacity": [
            "match",
            ["get", "layer_type"],
            "fan_zone",
            0.14,
            "restricted_vehicle_zone",
            0.18,
            "crowd_density_zone",
            0.16,
            0.14,
          ],
        },
        layout: {
          visibility: targetVisibility,
        },
      } as mapboxgl.AnyLayer, insertBefore);
    } else {
      setLayerVisibility(map, mapboxLayerIds.worldCupZoneFillLayer, visible);
    }

    if (!map.getLayer(mapboxLayerIds.worldCupZoneOutlineLayer)) {
      map.addLayer({
        id: mapboxLayerIds.worldCupZoneOutlineLayer,
        type: "line",
        source: mapboxLayerIds.worldCupEventSource,
        filter: [
          "in",
          ["get", "layer_type"],
          ["literal", ["fan_zone", "restricted_vehicle_zone", "crowd_density_zone"]],
        ],
        paint: {
          "line-color": [
            "match",
            ["get", "layer_type"],
            "fan_zone",
            "#86efac",
            "restricted_vehicle_zone",
            "#fdba74",
            "crowd_density_zone",
            "#e9d5ff",
            "#7dd3fc",
          ],
          "line-width": 2,
          "line-opacity": 0.85,
          "line-dasharray": [2, 1],
        },
        layout: {
          visibility: targetVisibility,
        },
      } as mapboxgl.AnyLayer, insertBefore);
    } else {
      setLayerVisibility(map, mapboxLayerIds.worldCupZoneOutlineLayer, visible);
    }

    if (!map.getLayer(mapboxLayerIds.worldCupStadiumFillLayer)) {
      map.addLayer({
        id: mapboxLayerIds.worldCupStadiumFillLayer,
        type: "fill",
        source: mapboxLayerIds.worldCupEventSource,
        filter: ["==", ["get", "layer_type"], "stadium_perimeter"],
        paint: {
          "fill-color": "#0ea5e9",
          "fill-opacity": 0.16,
        },
        layout: {
          visibility: targetVisibility,
        },
      } as mapboxgl.AnyLayer, insertBefore);
    } else {
      setLayerVisibility(map, mapboxLayerIds.worldCupStadiumFillLayer, visible);
    }

    if (!map.getLayer(mapboxLayerIds.worldCupStadiumOutlineLayer)) {
      map.addLayer({
        id: mapboxLayerIds.worldCupStadiumOutlineLayer,
        type: "line",
        source: mapboxLayerIds.worldCupEventSource,
        filter: ["==", ["get", "layer_type"], "stadium_perimeter"],
        paint: {
          "line-color": "#38bdf8",
          "line-width": 3.2,
          "line-opacity": 0.95,
        },
        layout: {
          visibility: targetVisibility,
        },
      } as mapboxgl.AnyLayer, insertBefore);
    } else {
      setLayerVisibility(map, mapboxLayerIds.worldCupStadiumOutlineLayer, visible);
    }

    if (!map.getLayer(mapboxLayerIds.worldCupRoadClosureLineLayer)) {
      map.addLayer({
        id: mapboxLayerIds.worldCupRoadClosureLineLayer,
        type: "line",
        source: mapboxLayerIds.worldCupEventSource,
        filter: ["==", ["get", "layer_type"], "road_closure"],
        paint: {
          "line-color": "#fb7185",
          "line-width": 4.5,
          "line-opacity": 0.95,
          "line-dasharray": [0.9, 0.6],
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: targetVisibility,
        },
      } as mapboxgl.AnyLayer, insertBefore);
    } else {
      setLayerVisibility(map, mapboxLayerIds.worldCupRoadClosureLineLayer, visible);
    }

    if (!map.getLayer(mapboxLayerIds.worldCupRoadClosureLabelLayer)) {
      map.addLayer({
        id: mapboxLayerIds.worldCupRoadClosureLabelLayer,
        type: "symbol",
        source: mapboxLayerIds.worldCupEventSource,
        filter: ["==", ["get", "layer_type"], "road_closure"],
        layout: {
          "symbol-placement": "line",
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          visibility: targetVisibility,
        },
        paint: {
          "text-color": "#ffe4e6",
          "text-halo-color": "#4c0519",
          "text-halo-width": 1.5,
        },
      } as mapboxgl.AnyLayer, insertBefore);
    } else {
      setLayerVisibility(map, mapboxLayerIds.worldCupRoadClosureLabelLayer, visible);
    }

    if (!map.getLayer(mapboxLayerIds.worldCupPointsLayer)) {
      map.addLayer({
        id: mapboxLayerIds.worldCupPointsLayer,
        type: "circle",
        source: mapboxLayerIds.worldCupEventSource,
        filter: [
          "in",
          ["get", "layer_type"],
          [
            "literal",
            [
              "medical_tent",
              "police_tent",
              "security_tent",
              "lost_and_found",
              "tourist_help",
              "transit_node",
            ],
          ],
        ],
        paint: {
          "circle-color": [
            "match",
            ["get", "layer_type"],
            "medical_tent",
            "#34d399",
            "police_tent",
            "#60a5fa",
            "security_tent",
            "#93c5fd",
            "lost_and_found",
            "#fbbf24",
            "tourist_help",
            "#f472b6",
            "transit_node",
            "#a78bfa",
            "#e2e8f0",
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            4,
            14,
            6.5,
            16,
            8.5,
          ],
          "circle-opacity": 0.92,
          "circle-stroke-color": "#0b1220",
          "circle-stroke-width": 1.6,
        },
        layout: {
          visibility: targetVisibility,
        },
      } as mapboxgl.AnyLayer, insertBefore);
    } else {
      setLayerVisibility(map, mapboxLayerIds.worldCupPointsLayer, visible);
    }

    if (!map.getLayer(mapboxLayerIds.worldCupPointsLabelLayer)) {
      map.addLayer({
        id: mapboxLayerIds.worldCupPointsLabelLayer,
        type: "symbol",
        source: mapboxLayerIds.worldCupEventSource,
        filter: [
          "in",
          ["get", "layer_type"],
          [
            "literal",
            [
              "medical_tent",
              "police_tent",
              "security_tent",
              "lost_and_found",
              "tourist_help",
              "transit_node",
            ],
          ],
        ],
        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-offset": [0, 1.15],
          "text-anchor": "top",
          "text-optional": true,
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          visibility: targetVisibility,
        },
        paint: {
          "text-color": "#e2e8f0",
          "text-halo-color": "#020617",
          "text-halo-width": 1.25,
        },
      } as mapboxgl.AnyLayer, insertBefore);
    } else {
      setLayerVisibility(map, mapboxLayerIds.worldCupPointsLabelLayer, visible);
    }

    // No teardown here: toggling should only flip visibility and update data.
  }, [layers, mapReady, mapRef, mode, visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    return () => {
      safelyRemoveLayer(map, mapboxLayerIds.worldCupPointsLabelLayer);
      safelyRemoveLayer(map, mapboxLayerIds.worldCupPointsLayer);
      safelyRemoveLayer(map, mapboxLayerIds.worldCupRoadClosureLabelLayer);
      safelyRemoveLayer(map, mapboxLayerIds.worldCupRoadClosureLineLayer);
      safelyRemoveLayer(map, mapboxLayerIds.worldCupStadiumOutlineLayer);
      safelyRemoveLayer(map, mapboxLayerIds.worldCupStadiumFillLayer);
      safelyRemoveLayer(map, mapboxLayerIds.worldCupZoneOutlineLayer);
      safelyRemoveLayer(map, mapboxLayerIds.worldCupZoneFillLayer);
      safelyRemoveSource(map, mapboxLayerIds.worldCupEventSource);
    };
  }, [mapRef]);

  return null;
}
