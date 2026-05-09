import type { SurgeCluster } from "@/lib/types";

export const mockSurgeClusters: SurgeCluster[] = [
  {
    cluster_id: "mock-cluster-downtown",
    title: "Downtown rescue cluster",
    incident_count: 6,
    urgency_breakdown: {
      critical: 2,
      urgent: 3,
      non_emergency: 1,
    },
    summary: "Mock high-priority calls around the downtown core.",
    top_recommended_action: "Stage ambulances near Union Station.",
    incident_ids: [],
    center: { lat: 43.651, lng: -79.382 },
  },
  {
    cluster_id: "mock-cluster-east",
    title: "East medical cluster",
    incident_count: 4,
    urgency_breakdown: {
      critical: 1,
      urgent: 3,
    },
    summary: "Mock medical and fire incidents east of the core.",
    top_recommended_action: "Route fire and EMS units from the east corridor.",
    incident_ids: [],
    center: { lat: 43.662, lng: -79.352 },
  },
];
