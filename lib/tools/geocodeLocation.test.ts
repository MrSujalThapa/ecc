import { beforeEach, describe, expect, it, vi } from "vitest";

const { geocodeWithMapboxMcp } = vi.hoisted(() => ({
  geocodeWithMapboxMcp: vi.fn(),
}));

vi.mock("@/lib/tools/mapbox/geocodeWithMapboxMcp", () => ({
  geocodeWithMapboxMcp,
}));

import { geocodeLocation } from "./geocodeLocation";

describe("geocodeLocation", () => {
  beforeEach(() => {
    geocodeWithMapboxMcp.mockReset();
  });

  it("falls back to the existing static landmark geocoder when MCP is unavailable", async () => {
    geocodeWithMapboxMcp.mockResolvedValue({
      status: "unavailable",
      source: "mapbox_mcp",
      query: "BMO Field",
      error: "disabled",
    });

    await expect(
      geocodeLocation({ location_text: "BMO Field" })
    ).resolves.toEqual({
      data: {
        normalized_location: "BMO Field, Exhibition Place, Toronto",
        coordinates: { lat: 43.6328, lng: -79.4187 },
        confidence: 0.95,
        provider_place_id: "mock:bmo_field",
      },
      source: "static_context",
    });
  });

  it("prefers the MCP result when geocoding succeeds", async () => {
    geocodeWithMapboxMcp.mockResolvedValue({
      status: "success",
      source: "mapbox_mcp",
      query: "BMO Field, Toronto, Canada",
      coordinates: { lat: 43.6332, lng: -79.4187 },
      place_name: "BMO Field, Toronto, Ontario",
      confidence: 0.98,
      provider_place_id: "mbx.123",
      raw: { ok: true },
    });

    await expect(
      geocodeLocation({ location_text: "BMO Field", city_context: "Toronto" })
    ).resolves.toEqual({
      data: {
        normalized_location: "BMO Field, Toronto, Ontario",
        coordinates: { lat: 43.6332, lng: -79.4187 },
        confidence: 0.98,
        provider_place_id: "mbx.123",
      },
      source: "mapbox_mcp",
    });
  });

  it("falls back to the existing mock/static geocoder when MCP returns an error", async () => {
    geocodeWithMapboxMcp.mockResolvedValue({
      status: "error",
      source: "mapbox_mcp",
      query: "Union Station",
      error: "upstream failure",
    });

    await expect(
      geocodeLocation({ location_text: "Union Station" })
    ).resolves.toEqual({
      data: {
        normalized_location: "Union Station, Toronto",
        coordinates: { lat: 43.6453, lng: -79.3806 },
        confidence: 0.95,
        provider_place_id: "mock:union_station",
      },
      source: "static_context",
    });
  });

  it("keeps deterministic jitter fallback for unknown locations when MCP is unavailable", async () => {
    geocodeWithMapboxMcp.mockResolvedValue({
      status: "unavailable",
      source: "mapbox_mcp",
      query: "Some Unknown Place",
      error: "disabled",
    });

    const first = await geocodeLocation({ location_text: "Some Unknown Place" });
    const second = await geocodeLocation({ location_text: "Some Unknown Place" });

    expect(first.source).toBe("mock");
    expect(second.source).toBe("mock");
    expect(first.data).toEqual(second.data);
    expect(first.data.normalized_location).toContain("Some Unknown Place");
    expect(typeof first.data.confidence).toBe("number");
    expect(first.data.coordinates).toEqual(second.data.coordinates);
  });
});
