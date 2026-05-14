import { describe, expect, it } from "vitest";
import { buildClusterSourceView } from "./buildClusterSourceView";

describe("buildClusterSourceView", () => {
  it("maps backend geoops source to the correct label", () => {
    expect(buildClusterSourceView("backend_geoops")).toEqual({
      label: "Backend GeoOps",
      tone: "info",
      description: "Authoritative backend surge analysis from persisted cluster data.",
    });
  });

  it("maps client fallback source to the correct label", () => {
    expect(buildClusterSourceView("client_fallback")).toEqual({
      label: "Client fallback",
      tone: "warning",
      description:
        "Visualization-derived grouping from the incidents currently loaded on the map.",
    });
  });

  it("renders an honest unknown state when source is missing", () => {
    expect(buildClusterSourceView(undefined)).toEqual({
      label: "Unknown source",
      tone: "default",
      description: "Cluster provenance is not available in this view yet.",
    });
  });
});
