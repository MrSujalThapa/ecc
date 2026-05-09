import type { EventLayer } from "@/lib/types";

/**
 * Phase 7 mock geography: Toronto World Cup / event surge demo around Exhibition Place (BMO Field).
 * Coordinates are approximate and intentionally compact to keep the map readable.
 */
export const worldCupEventLayers: EventLayer[] = [
  {
    id: "world-cup-stadium-perimeter-bmo-field",
    mode: "world_cup",
    layer_type: "stadium_perimeter",
    name: "BMO Field perimeter (mock)",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-79.42025, 43.63325],
          [-79.41765, 43.63255],
          [-79.41585, 43.63355],
          [-79.41665, 43.6351],
          [-79.41915, 43.63535],
          [-79.42045, 43.63435],
          [-79.42025, 43.63325],
        ],
      ],
    },
    metadata: {
      capacity: 30000,
      note: "Demo stadium footprint for surge layer visuals.",
    },
  },
  {
    id: "world-cup-fan-zone-exhibition-west",
    mode: "world_cup",
    layer_type: "fan_zone",
    name: "Fan zone: Exhibition West",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-79.4243, 43.6324],
          [-79.4212, 43.6316],
          [-79.4194, 43.6327],
          [-79.421, 43.6341],
          [-79.4239, 43.6342],
          [-79.4243, 43.6324],
        ],
      ],
    },
    metadata: {
      crowd_target: "high",
      amenities: ["screens", "water", "first_aid"],
    },
  },
  {
    id: "world-cup-fan-zone-exhibition-east",
    mode: "world_cup",
    layer_type: "fan_zone",
    name: "Fan zone: Exhibition East",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-79.417, 43.6316],
          [-79.4142, 43.6317],
          [-79.4136, 43.6332],
          [-79.4151, 43.6343],
          [-79.4172, 43.6341],
          [-79.418, 43.6327],
          [-79.417, 43.6316],
        ],
      ],
    },
    metadata: {
      crowd_target: "medium",
      amenities: ["screens", "info"],
    },
  },
  {
    id: "world-cup-restricted-vehicle-princes",
    mode: "world_cup",
    layer_type: "restricted_vehicle_zone",
    name: "Restricted vehicle zone: Princes' Blvd (mock)",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-79.4232, 43.63105],
          [-79.4144, 43.63115],
          [-79.4139, 43.63245],
          [-79.4226, 43.63255],
          [-79.4232, 43.63105],
        ],
      ],
    },
    metadata: {
      enforcement: "strict",
      allowed: ["emergency", "transit", "credentialed"],
    },
  },
  {
    id: "world-cup-crowd-density-south-plaza",
    mode: "world_cup",
    layer_type: "crowd_density_zone",
    name: "High-density crowd: South plaza",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-79.4216, 43.63265],
          [-79.4187, 43.63195],
          [-79.4172, 43.6331],
          [-79.4186, 43.63405],
          [-79.4209, 43.634],
          [-79.4216, 43.63265],
        ],
      ],
    },
    metadata: {
      density: "high",
      risk: "heat",
    },
  },
  {
    id: "world-cup-crowd-density-north-gates",
    mode: "world_cup",
    layer_type: "crowd_density_zone",
    name: "High-density crowd: North gates",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-79.4201, 43.6353],
          [-79.4176, 43.63505],
          [-79.4169, 43.6361],
          [-79.4182, 43.63685],
          [-79.4201, 43.63655],
          [-79.4206, 43.63575],
          [-79.4201, 43.6353],
        ],
      ],
    },
    metadata: {
      density: "very_high",
      risk: "crush",
    },
  },
  {
    id: "world-cup-medical-tent-1",
    mode: "world_cup",
    layer_type: "medical_tent",
    name: "Medical tent: Gate A",
    geometry: {
      type: "Point",
      coordinates: [-79.41855, 43.63435],
    },
    metadata: {
      staffed: true,
      supplies: "advanced",
    },
  },
  {
    id: "world-cup-medical-tent-2",
    mode: "world_cup",
    layer_type: "medical_tent",
    name: "Medical tent: Fan zone west",
    geometry: {
      type: "Point",
      coordinates: [-79.42245, 43.63335],
    },
    metadata: {
      staffed: true,
      supplies: "basic",
    },
  },
  {
    id: "world-cup-police-post-1",
    mode: "world_cup",
    layer_type: "police_tent",
    name: "Police post: Princes' Blvd checkpoint",
    geometry: {
      type: "Point",
      coordinates: [-79.4187, 43.63175],
    },
    metadata: {
      unit: "TPS",
      radios: true,
    },
  },
  {
    id: "world-cup-security-post-1",
    mode: "world_cup",
    layer_type: "security_tent",
    name: "Security post: North entrance",
    geometry: {
      type: "Point",
      coordinates: [-79.41895, 43.63605],
    },
    metadata: {
      vendor: "event_security",
      screening: "bag_check",
    },
  },
  {
    id: "world-cup-lost-and-found-1",
    mode: "world_cup",
    layer_type: "lost_and_found",
    name: "Lost & found: Info kiosk",
    geometry: {
      type: "Point",
      coordinates: [-79.41615, 43.63375],
    },
    metadata: {
      languages: ["en", "fr", "es"],
    },
  },
  {
    id: "world-cup-tourist-help-1",
    mode: "world_cup",
    layer_type: "tourist_help",
    name: "Tourist help: Transit hub desk",
    geometry: {
      type: "Point",
      coordinates: [-79.41395, 43.63225],
    },
    metadata: {
      languages: ["en", "fr", "pt", "es"],
      services: ["directions", "safety", "accessibility"],
    },
  },
  {
    id: "world-cup-transit-node-exhibition",
    mode: "world_cup",
    layer_type: "transit_node",
    name: "Transit node: Exhibition GO / TTC",
    geometry: {
      type: "Point",
      coordinates: [-79.41555, 43.63585],
    },
    metadata: {
      type: "rail_streetcar",
      congestion: "high",
    },
  },
  {
    id: "world-cup-transit-node-lakeshore",
    mode: "world_cup",
    layer_type: "transit_node",
    name: "Transit node: Lakeshore access",
    geometry: {
      type: "Point",
      coordinates: [-79.42355, 43.63125],
    },
    metadata: {
      type: "bus_shuttle",
      congestion: "medium",
    },
  },
  {
    id: "world-cup-road-closure-princes-blvd",
    mode: "world_cup",
    layer_type: "road_closure",
    name: "Road closure: Princes' Blvd",
    geometry: {
      type: "LineString",
      coordinates: [
        [-79.4233, 43.6317],
        [-79.4204, 43.63175],
        [-79.4176, 43.63185],
        [-79.4149, 43.63195],
      ],
    },
    metadata: {
      reason: "stadium security perimeter",
      status: "closed",
      enforced_until: "23:30",
    },
  },
  {
    id: "world-cup-road-closure-lakeshore-ramp",
    mode: "world_cup",
    layer_type: "road_closure",
    name: "Road closure: Lakeshore ramp staging",
    geometry: {
      type: "LineString",
      coordinates: [
        [-79.4262, 43.63215],
        [-79.42425, 43.63175],
        [-79.4222, 43.63125],
      ],
    },
    metadata: {
      reason: "shuttle staging",
      status: "restricted",
      enforced_until: "22:45",
    },
  },
];

