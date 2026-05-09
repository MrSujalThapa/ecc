"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { AppMode, Incident, Responder, SurgeCluster } from "@/lib/types";
import { ClusterLayer } from "@/components/map/ClusterLayer";
import { DisasterStaticLayers } from "@/components/map/DisasterStaticLayers";
import { EventLayer } from "@/components/map/EventLayer";
import { HeatmapLayer } from "@/components/map/HeatmapLayer";
import { MapLayerControls } from "@/components/map/MapLayerControls";
import { urgencyMarkerClass } from "@/lib/map/incidentStyling";
import { isValidCoordinates } from "@/lib/map/geojson";
import {
  defaultMapLayerVisibility,
  disasterMapLayerIds,
  type MapLayerId,
  type MapLayerVisibility,
} from "@/lib/map/layers";
import { CommandMapOffline } from "@/components/map/CommandMapOffline";
import { ResponderLayer } from "@/components/map/ResponderLayer";

type CommandMapProps = {
  incidents: Incident[];
  clusters: SurgeCluster[];
  mode: AppMode | "all";
  responders: Responder[];
  responderMessage: string | null;
  selectedIncidentId: string | null;
  selectedClusterId: string | null;
  onSelectIncident: (incidentId: string) => void;
  onSelectCluster: (clusterId: string) => void;
  onClearCluster: () => void;
};

const torontoCenter: [number, number] = [-79.3832, 43.6532];

function getFirstSymbolLayerId(map: mapboxgl.Map) {
  const layers = map.getStyle().layers ?? [];

  const firstSymbolLayer = layers.find(
    (layer) =>
      layer.type === "symbol" &&
      "layout" in layer &&
      layer.layout &&
      "text-field" in layer.layout,
  );

  return firstSymbolLayer?.id;
}


function setupThreeDimensionalMap(map: mapboxgl.Map) {
  const style = map.getStyle();
  const sources = style.sources ?? {};

  if (!map.getSource("mapbox-dem")) {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
  }

  map.setTerrain({
    source: "mapbox-dem",
    exaggeration: 1.25,
  });

  map.setFog({
    color: "rgb(15, 23, 42)",
    "high-color": "rgb(14, 165, 233)",
    "horizon-blend": 0.08,
    "space-color": "rgb(2, 6, 23)",
    "star-intensity": 0.12,
  });

  if (sources.composite && !map.getLayer("3d-buildings")) {
    const labelLayerId = getFirstSymbolLayerId(map);

    map.addLayer(
      {
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", ["get", "extrude"], "true"],
        type: "fill-extrusion",
        minzoom: 13,
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            "#1e293b",
            15,
            "#475569",
          ],
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            0,
            15,
            ["get", "height"],
          ],
          "fill-extrusion-base": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            0,
            15,
            ["get", "min_height"],
          ],
          "fill-extrusion-opacity": 0.55,
        },
      } as mapboxgl.AnyLayer,
      labelLayerId,
    );
  }
}

function createIncidentMarkerElement({
  incident,
  isSelected,
  onSelectIncident,
}: {
  incident: Incident;
  isSelected: boolean;
  onSelectIncident: (incidentId: string) => void;
}) {
  const wrapper = document.createElement("div");

  /*
   * Mapbox owns positioning on this outer wrapper.
   * Do not put scale/transform classes here, because Mapbox uses transforms
   * internally to place markers.
   */
  wrapper.className =
    "pointer-events-auto flex h-10 w-10 items-center justify-center";

  const button = document.createElement("button");
  button.type = "button";

  button.setAttribute(
    "aria-label",
    `Select incident ${incident.public_id ?? incident.id}`,
  );

  button.className = [
    "block cursor-pointer rounded-full border-2 shadow-lg ring-4",
    "transition-[width,height,box-shadow,background-color,border-color] duration-150 ease-out",
    "focus:outline-none focus:ring-white/80",
    urgencyMarkerClass[incident.urgency],
    isSelected
      ? "h-7 w-7 border-cyan-100 ring-white/75"
      : "h-5 w-5 border-white/80 ring-white/20 hover:h-6 hover:w-6 hover:ring-white/50",
  ].join(" ");

  const selectIncident = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectIncident(incident.id);
  };

  button.addEventListener("click", selectIncident);

  button.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  button.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  wrapper.appendChild(button);

  return wrapper;
}

export function CommandMap({
  incidents,
  clusters,
  mode,
  responders,
  responderMessage,
  selectedIncidentId,
  selectedClusterId,
  onSelectIncident,
  onSelectCluster,
  onClearCluster,
}: CommandMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [layerOverrides, setLayerOverrides] = useState<
    Partial<MapLayerVisibility>
  >({});

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  /** Disaster-only overlays (heatmap, zones, roads); off in normal. Incident clusters are core. */
  const disasterStackApplicable =
    mode === "disaster" || mode === "world_cup" || mode === "all";
  /** Event overlays: world_cup or queue "All modes". */
  const eventLayersApplicable = mode === "world_cup" || mode === "all";

  const layerVisibility: MapLayerVisibility = useMemo(() => {
    const base: MapLayerVisibility = {
      ...defaultMapLayerVisibility,
      ...Object.fromEntries(
        disasterMapLayerIds.map((layerId) => [
          layerId,
          disasterStackApplicable,
        ]),
      ),
      eventLayers: eventLayersApplicable,
    };
    const merged: MapLayerVisibility = { ...base, ...layerOverrides };
    if (!disasterStackApplicable) {
      for (const id of disasterMapLayerIds) {
        merged[id] = false;
      }
    }
    if (!eventLayersApplicable) {
      merged.eventLayers = false;
    }
    return merged;
  }, [disasterStackApplicable, eventLayersApplicable, layerOverrides]);

  const toggleLayer = (layer: MapLayerId) => {
    if (disasterMapLayerIds.includes(layer) && !disasterStackApplicable) {
      return;
    }
    if (layer === "eventLayers" && !eventLayersApplicable) {
      return;
    }

    const nextValue = !layerVisibility[layer];
    if (layer === "clusters" && !nextValue) {
      onClearCluster();
    }

    setLayerOverrides((current) => ({
      ...current,
      [layer]: nextValue,
    }));
  };

  useEffect(() => {
    if (!containerRef.current || !wrapperRef.current || !token || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      center: torontoCenter,
      zoom: 13.35,
      pitch: 62,
      bearing: -22,
      style: "mapbox://styles/mapbox/dark-v11",
      attributionControl: false,
      maxPitch: 75,
    });

    mapRef.current = map;

    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );

    let isMounted = true;
    let resizeAnimationFrame: number | null = null;

    const resizeMap = () => {
      if (resizeAnimationFrame !== null) {
        window.cancelAnimationFrame(resizeAnimationFrame);
      }

      resizeAnimationFrame = window.requestAnimationFrame(() => {
        resizeAnimationFrame = null;

        if (isMounted) {
          map.resize();
        }
      });
    };

    map.once("load", () => {
      if (!isMounted) {
        return;
      }

      setupThreeDimensionalMap(map);
      setMapReady(true);
      resizeMap();
    });

    const resizeObserver = new ResizeObserver(resizeMap);
    resizeObserver.observe(wrapperRef.current);
    resizeObserver.observe(containerRef.current);

    const initialResizeTimeout = window.setTimeout(resizeMap, 100);
    window.addEventListener("resize", resizeMap);

    return () => {
      isMounted = false;

      window.clearTimeout(initialResizeTimeout);
      window.removeEventListener("resize", resizeMap);
      resizeObserver.disconnect();

      if (resizeAnimationFrame !== null) {
        window.cancelAnimationFrame(resizeAnimationFrame);
      }

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (!layerVisibility.incidents) {
      return;
    }

    const nextMarkers = incidents
      .filter((incident) => incident.coordinates !== null)
      .map((incident) => {
        const markerElement = createIncidentMarkerElement({
          incident,
          isSelected: selectedIncidentId === incident.id,
          onSelectIncident,
        });

        return new mapboxgl.Marker({
          element: markerElement,
          anchor: "center",
        })
          .setLngLat([incident.coordinates!.lng, incident.coordinates!.lat])
          .addTo(map);
      });

    markersRef.current = nextMarkers;
  }, [
    incidents,
    layerVisibility.incidents,
    mapReady,
    onSelectIncident,
    selectedIncidentId,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const selectedIncident = incidents.find(
      (incident) => incident.id === selectedIncidentId,
    );

    if (!selectedIncident?.coordinates) {
      return;
    }

    map.flyTo({
      center: [
        selectedIncident.coordinates.lng,
        selectedIncident.coordinates.lat,
      ],
      zoom: Math.max(map.getZoom(), 15.2),
      pitch: 64,
      bearing: -24,
      duration: 700,
      essential: true,
    });
  }, [incidents, mapReady, selectedIncidentId]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady || !selectedClusterId) {
      return;
    }

    setLayerOverrides((current) =>
      current.clusters === true ? current : { ...current, clusters: true },
    );

    const cluster = clusters.find((c) => c.cluster_id === selectedClusterId);
    const center = cluster?.center;

    if (!center || !isValidCoordinates(center)) {
      return;
    }

    map.flyTo({
      center: [center.lng, center.lat],
      zoom: Math.max(map.getZoom(), 14.4),
      pitch: 64,
      bearing: -24,
      duration: 700,
      essential: true,
    });
  }, [clusters, mapReady, selectedClusterId]);

  if (!token) {
    return (
      <CommandMapOffline
        incidents={incidents}
        onSelectIncident={onSelectIncident}
        selectedIncidentId={selectedIncidentId}
      />
    );
  }

  const pinnedCount = incidents.filter((incident) => incident.coordinates).length;
  const awaitingLocationCount = incidents.length - pinnedCount;
  const mappedResponderCount = responders.filter(
    (responder) => responder.coordinates,
  ).length;

  const modeLabel = mode === "all" ? "All modes" : mode.replace("_", " ");
  const modeTone =
    mode === "disaster"
      ? "border-orange-300/20 bg-orange-500/10 text-orange-50"
      : mode === "world_cup"
        ? "border-violet-300/20 bg-violet-500/10 text-violet-50"
        : mode === "normal"
          ? "border-cyan-300/20 bg-cyan-500/10 text-cyan-50"
          : "border-slate-400/20 bg-[#000814]/40 text-slate-200";

  return (
    <div
      ref={wrapperRef}
      className="relative h-full min-h-0 w-full overflow-hidden bg-[#000814]"
    >
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      <ResponderLayer
        mapRef={mapRef}
        mapReady={mapReady}
        responders={responders}
        visible={layerVisibility.responders}
      />

      <HeatmapLayer
        mapRef={mapRef}
        mapReady={mapReady}
        incidents={incidents}
        visible={layerVisibility.heatmap}
      />

      <ClusterLayer
        mapRef={mapRef}
        mapReady={mapReady}
        clusters={clusters}
        selectedClusterId={selectedClusterId}
        visible={layerVisibility.clusters}
        onSelectCluster={onSelectCluster}
      />

      <DisasterStaticLayers
        mapRef={mapRef}
        mapReady={mapReady}
        disasterZonesVisible={layerVisibility.disasterZones}
        blockedRoadsVisible={layerVisibility.blockedRoads}
      />

      <EventLayer
        mapRef={mapRef}
        mapReady={mapReady}
        visible={layerVisibility.eventLayers}
        mode={mode}
      />

      <MapLayerControls
        mode={mode}
        visibility={layerVisibility}
        onToggleLayer={toggleLayer}
      />

      {responderMessage ? (
        <div
          className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-sm rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-2xl backdrop-blur"
          role="status"
        >
          {responderMessage}
        </div>
      ) : null}
    </div>
  );
}
