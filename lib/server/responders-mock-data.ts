import type { Responder } from "@/lib/types/domain";
import { isoNow } from "./iso-now";

const SEED: Omit<Responder, "updated_at">[] = [
  // EMS / ambulance
  {
    id: "EMS-2",
    type: "ambulance",
    status: "available",
    display_name: "EMS Unit 2",
    coordinates: { lat: 43.641, lng: -79.389 },
    assigned_incident_id: null,
  },
  {
    id: "EMS-7",
    type: "ambulance",
    status: "available",
    display_name: "EMS Unit 7",
    coordinates: { lat: 43.6478, lng: -79.4032 },
    assigned_incident_id: null,
  },
  {
    id: "EMS-12",
    type: "ambulance",
    status: "en_route",
    display_name: "EMS Unit 12",
    coordinates: { lat: 43.6325, lng: -79.4198 },
    assigned_incident_id: null,
  },
  // Police
  {
    id: "POL-4",
    type: "police",
    status: "en_route",
    display_name: "Police Unit 4",
    coordinates: { lat: 43.652, lng: -79.38 },
    assigned_incident_id: null,
  },
  {
    id: "POL-9",
    type: "police",
    status: "available",
    display_name: "Police Unit 9",
    coordinates: { lat: 43.6655, lng: -79.4046 },
    assigned_incident_id: null,
  },
  {
    id: "POL-15",
    type: "police",
    status: "available",
    display_name: "Police Unit 15",
    coordinates: { lat: 43.6358, lng: -79.4181 },
    assigned_incident_id: null,
  },
  // Fire
  {
    id: "FIRE-1",
    type: "fire",
    status: "available",
    display_name: "Engine 1",
    coordinates: { lat: 43.635, lng: -79.402 },
    assigned_incident_id: null,
  },
  {
    id: "FIRE-6",
    type: "fire",
    status: "available",
    display_name: "Engine 6",
    coordinates: { lat: 43.6669, lng: -79.4031 },
    assigned_incident_id: null,
  },
  // Event staff (project_details §4.4 / Responder.type "event_staff")
  {
    id: "EVS-1",
    type: "event_staff",
    status: "available",
    display_name: "Event Staff — Stadium North",
    coordinates: { lat: 43.6361, lng: -79.4188 },
    assigned_incident_id: null,
  },
  {
    id: "EVS-2",
    type: "event_staff",
    status: "available",
    display_name: "Event Staff — Fan Zone West",
    coordinates: { lat: 43.6334, lng: -79.4226 },
    assigned_incident_id: null,
  },
  {
    id: "EVS-3",
    type: "event_staff",
    status: "available",
    display_name: "Event Staff — Fan Zone East",
    coordinates: { lat: 43.6332, lng: -79.4154 },
    assigned_incident_id: null,
  },
  {
    id: "EVS-4",
    type: "event_staff",
    status: "en_route",
    display_name: "Event Staff — Transit Hub",
    coordinates: { lat: 43.6358, lng: -79.4156 },
    assigned_incident_id: null,
  },
];

export const getMockResponders = (): Responder[] => {
  const t = isoNow();
  return SEED.map((r) => ({ ...r, updated_at: t }));
};
