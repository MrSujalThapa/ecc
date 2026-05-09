/**
 * Shared geography primitives for incidents, responders, tools, and map layers.
 */

export type Coordinates = {
  lat: number;
  lng: number;
};

/** GeoJSON geometry stored in event_layers.geometry (docs/project_details §12.6). */
export type GeoJsonGeometry = Record<string, unknown>;
