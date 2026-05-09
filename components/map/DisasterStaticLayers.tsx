"use client";

import { useEffect, type RefObject } from "react";
import mapboxgl from "mapbox-gl";
import { blockedRoadLayers, disasterImpactZones } from "@/lib/mock/disasterLayers";
import { eventLayersToFeatureCollection } from "@/lib/map/geojson";
import { mapboxLayerIds } from "@/lib/map/layers";
import {
  safelyRemoveLayer,
  safelyRemoveSource,
} from "@/lib/map/mapboxLifecycle";

type DisasterStaticLayersProps = {
  mapRef: RefObject<mapboxgl.Map | null>;
  mapReady: boolean;
  disasterZonesVisible: boolean;
  blockedRoadsVisible: boolean;
};

function asMapboxGeoJson(data: ReturnType<typeof eventLayersToFeatureCollection>) {
  return data as Parameters<mapboxgl.GeoJSONSource["setData"]>[0];
}

export function DisasterStaticLayers({
  mapRef,
  mapReady,
  disasterZonesVisible,
  blockedRoadsVisible,
}: DisasterStaticLayersProps) {
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const zoneData = eventLayersToFeatureCollection(disasterImpactZones);
    const zoneSource = map.getSource(mapboxLayerIds.impactZoneSource);

    if (!zoneSource) {
      map.addSource(mapboxLayerIds.impactZoneSource, {
        type: "geojson",
        data: asMapboxGeoJson(zoneData),
      });
    } else {
      (zoneSource as mapboxgl.GeoJSONSource).setData(asMapboxGeoJson(zoneData));
    }

    if (!map.getLayer(mapboxLayerIds.impactZoneFillLayer)) {
      map.addLayer({
        id: mapboxLayerIds.impactZoneFillLayer,
        type: "fill",
        source: mapboxLayerIds.impactZoneSource,
        paint: {
          "fill-color": [
            "match",
            ["get", "severity"],
            "high",
            "#ef4444",
            "medium",
            "#f97316",
            "moderate",
            "#f97316",
            "#f59e0b",
          ],
          "fill-opacity": 0.18,
        },
        layout: {
          visibility: disasterZonesVisible ? "visible" : "none",
        },
      } as mapboxgl.AnyLayer);
    } else {
      map.setLayoutProperty(
        mapboxLayerIds.impactZoneFillLayer,
        "visibility",
        disasterZonesVisible ? "visible" : "none",
      );
    }

    if (!map.getLayer(mapboxLayerIds.impactZoneLineLayer)) {
      map.addLayer({
        id: mapboxLayerIds.impactZoneLineLayer,
        type: "line",
        source: mapboxLayerIds.impactZoneSource,
        paint: {
          "line-color": [
            "match",
            ["get", "severity"],
            "high",
            "#fca5a5",
            "medium",
            "#fdba74",
            "moderate",
            "#fdba74",
            "#fcd34d",
          ],
          "line-width": 2,
          "line-dasharray": [2, 1],
        },
        layout: {
          visibility: disasterZonesVisible ? "visible" : "none",
        },
      } as mapboxgl.AnyLayer);
    } else {
      map.setLayoutProperty(
        mapboxLayerIds.impactZoneLineLayer,
        "visibility",
        disasterZonesVisible ? "visible" : "none",
      );
    }

    const roadData = eventLayersToFeatureCollection(blockedRoadLayers);
    const roadSource = map.getSource(mapboxLayerIds.blockedRoadSource);

    if (!roadSource) {
      map.addSource(mapboxLayerIds.blockedRoadSource, {
        type: "geojson",
        data: asMapboxGeoJson(roadData),
      });
    } else {
      (roadSource as mapboxgl.GeoJSONSource).setData(asMapboxGeoJson(roadData));
    }

    if (!map.getLayer(mapboxLayerIds.blockedRoadLineLayer)) {
      map.addLayer({
        id: mapboxLayerIds.blockedRoadLineLayer,
        type: "line",
        source: mapboxLayerIds.blockedRoadSource,
        paint: {
          "line-color": "#f43f5e",
          "line-width": 4,
          "line-opacity": 0.9,
          "line-dasharray": [1, 1],
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: blockedRoadsVisible ? "visible" : "none",
        },
      } as mapboxgl.AnyLayer);
    } else {
      map.setLayoutProperty(
        mapboxLayerIds.blockedRoadLineLayer,
        "visibility",
        blockedRoadsVisible ? "visible" : "none",
      );
    }

    if (!map.getLayer(mapboxLayerIds.blockedRoadLabelLayer)) {
      map.addLayer({
        id: mapboxLayerIds.blockedRoadLabelLayer,
        type: "symbol",
        source: mapboxLayerIds.blockedRoadSource,
        layout: {
          "symbol-placement": "line",
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          visibility: blockedRoadsVisible ? "visible" : "none",
        },
        paint: {
          "text-color": "#fecdd3",
          "text-halo-color": "#450a0a",
          "text-halo-width": 1.5,
        },
      } as mapboxgl.AnyLayer);
    } else {
      map.setLayoutProperty(
        mapboxLayerIds.blockedRoadLabelLayer,
        "visibility",
        blockedRoadsVisible ? "visible" : "none",
      );
    }

    return () => {
      [
        mapboxLayerIds.blockedRoadLabelLayer,
        mapboxLayerIds.blockedRoadLineLayer,
        mapboxLayerIds.impactZoneLineLayer,
        mapboxLayerIds.impactZoneFillLayer,
      ].forEach((layerId) => {
        safelyRemoveLayer(map, layerId);
      });

      [mapboxLayerIds.blockedRoadSource, mapboxLayerIds.impactZoneSource].forEach(
        (sourceId) => {
          safelyRemoveSource(map, sourceId);
        },
      );
    };
  }, [blockedRoadsVisible, disasterZonesVisible, mapReady, mapRef]);

  return null;
}
