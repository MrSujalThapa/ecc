import type { SurgeCluster } from "@/lib/types";

export type ClusterSourceView = {
  label: string;
  tone: "info" | "warning" | "default";
  description: string;
};

export const buildClusterSourceView = (
  source: SurgeCluster["source"] | undefined,
): ClusterSourceView => {
  switch (source) {
    case "backend_geoops":
      return {
        label: "Backend GeoOps",
        tone: "info",
        description: "Authoritative backend surge analysis from persisted cluster data.",
      };
    case "client_fallback":
      return {
        label: "Client fallback",
        tone: "warning",
        description: "Visualization-derived grouping from the incidents currently loaded on the map.",
      };
    default:
      return {
        label: "Unknown source",
        tone: "default",
        description: "Cluster provenance is not available in this view yet.",
      };
  }
};
