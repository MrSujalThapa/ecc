import type { EventLayer } from "@/lib/types";

export const disasterImpactZones: EventLayer[] = [
  {
    id: "impact-zone-downtown-flood",
    mode: "disaster",
    layer_type: "impact_zone",
    name: "Downtown flood impact zone",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-79.402, 43.646],
          [-79.389, 43.638],
          [-79.369, 43.646],
          [-79.371, 43.661],
          [-79.391, 43.667],
          [-79.402, 43.646],
        ],
      ],
    },
    metadata: {
      severity: "high",
      summary: "Mock flood impact area for disaster dashboard drills.",
    },
  },
  {
    id: "impact-zone-east-fire",
    mode: "disaster",
    layer_type: "impact_zone",
    name: "East response impact zone",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-79.364, 43.653],
          [-79.351, 43.649],
          [-79.34, 43.66],
          [-79.349, 43.671],
          [-79.366, 43.667],
          [-79.364, 43.653],
        ],
      ],
    },
    metadata: {
      severity: "medium",
      summary: "Mock fire and medical response area.",
    },
  },
];

export const blockedRoadLayers: EventLayer[] = [
  {
    id: "blocked-road-front-st",
    mode: "disaster",
    layer_type: "blocked_road",
    name: "Front Street closure",
    geometry: {
      type: "LineString",
      coordinates: [
        [-79.397, 43.644],
        [-79.388, 43.645],
        [-79.378, 43.646],
        [-79.369, 43.648],
      ],
    },
    metadata: {
      reason: "flooding",
      status: "closed",
    },
  },
  {
    id: "blocked-road-jarvis",
    mode: "disaster",
    layer_type: "blocked_road",
    name: "Jarvis Street partial closure",
    geometry: {
      type: "LineString",
      coordinates: [
        [-79.371, 43.649],
        [-79.374, 43.656],
        [-79.377, 43.664],
      ],
    },
    metadata: {
      reason: "emergency vehicles staged",
      status: "restricted",
    },
  },
];
