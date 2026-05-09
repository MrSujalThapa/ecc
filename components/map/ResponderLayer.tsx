"use client";

import { useEffect, useRef, type RefObject } from "react";
import mapboxgl from "mapbox-gl";
import type { Responder } from "@/lib/types";
import {
  formatResponderType,
  responderMarkerClass,
} from "@/lib/map/layers";

type ResponderLayerProps = {
  mapRef: RefObject<mapboxgl.Map | null>;
  mapReady: boolean;
  responders: Responder[];
  visible: boolean;
};

function createResponderMarkerElement(responder: Responder) {
  const wrapper = document.createElement("div");
  wrapper.className = "pointer-events-auto flex items-center justify-center";

  const marker = document.createElement("div");
  marker.className = [
    "flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-lg ring-4 ring-slate-950/40",
    "text-[10px] font-black uppercase",
    responderMarkerClass(responder),
  ].join(" ");

  marker.title = `${responder.display_name} (${formatResponderType(
    responder.type,
  )}) - ${responder.status}`;
  marker.setAttribute("aria-label", marker.title);
  marker.textContent = responder.type === "event_staff" ? "E" : responder.type[0] ?? "R";

  const stopMapGesture = (event: Event) => {
    event.stopPropagation();
  };

  marker.addEventListener("pointerdown", stopMapGesture);
  marker.addEventListener("dblclick", stopMapGesture);
  wrapper.appendChild(marker);

  return wrapper;
}

export function ResponderLayer({
  mapRef,
  mapReady,
  responders,
  visible,
}: ResponderLayerProps) {
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const map = mapRef.current;

    if (!map || !mapReady || !visible) {
      return;
    }

    markersRef.current = responders
      .filter((responder) => responder.coordinates)
      .map((responder) =>
        new mapboxgl.Marker({
          element: createResponderMarkerElement(responder),
          anchor: "center",
        })
          .setLngLat([responder.coordinates.lng, responder.coordinates.lat])
          .addTo(map),
      );

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [mapReady, mapRef, responders, visible]);

  return null;
}
