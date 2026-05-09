import type mapboxgl from "mapbox-gl";

export function safelyRemoveLayer(map: mapboxgl.Map, layerId: string) {
  try {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  } catch {
    // Mapbox may already have torn down its internal style during unmount.
  }
}

export function safelyRemoveSource(map: mapboxgl.Map, sourceId: string) {
  try {
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  } catch {
    // Mapbox may already have torn down its internal style during unmount.
  }
}
