import type { Responder } from "@/lib/types/domain";
import { isoNow } from "./iso-now";

const SEED: Omit<Responder, "updated_at">[] = [
  {
    id: "EMS-2",
    type: "ambulance",
    status: "available",
    display_name: "EMS Unit 2",
    coordinates: { lat: 43.641, lng: -79.389 },
    assigned_incident_id: null,
  },
  {
    id: "POL-4",
    type: "police",
    status: "en_route",
    display_name: "Police Unit 4",
    coordinates: { lat: 43.652, lng: -79.38 },
    assigned_incident_id: null,
  },
  {
    id: "FIRE-1",
    type: "fire",
    status: "available",
    display_name: "Engine 1",
    coordinates: { lat: 43.635, lng: -79.402 },
    assigned_incident_id: null,
  },
];

export const getMockResponders = (): Responder[] => {
  const t = isoNow();
  return SEED.map((r) => ({ ...r, updated_at: t }));
};
