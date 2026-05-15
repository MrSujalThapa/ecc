import { describe, expect, it } from "vitest";
import { geocodeWithMapboxMcp } from "./geocodeWithMapboxMcp";
import type { MapboxMcpClient } from "@/lib/mcp/types";

const createClient = (
  result: Awaited<ReturnType<MapboxMcpClient["callTool"]>>
): MapboxMcpClient => ({
  getConfig: () => ({
    enabled: true,
    transport: "hosted",
    endpoint: "https://mcp.mapbox.com/mcp",
    accessToken: "pk.test",
    timeoutMs: 5000,
  }),
  getAvailability: () => ({
    available: true,
    reason: "enabled",
    transport: "hosted",
    endpoint: "https://mcp.mapbox.com/mcp",
    hasAccessToken: true,
    timeoutMs: 5000,
  }),
  callTool: async () => result,
});

describe("geocodeWithMapboxMcp", () => {
  it("returns unavailable when the MCP client is disabled", async () => {
    const result = await geocodeWithMapboxMcp(
      { location_text: "BMO Field" },
      {
        client: createClient({
          ok: false,
          source: "mapbox_mcp",
          toolName: "search_and_geocode_tool",
          code: "disabled",
          message: "disabled",
          raw: null,
        }),
      }
    );

    expect(result).toEqual({
      status: "unavailable",
      source: "mapbox_mcp",
      query: "BMO Field",
      raw: null,
      error: "disabled",
    });
  });

  it("returns unavailable when the MCP client is misconfigured", async () => {
    const result = await geocodeWithMapboxMcp(
      { location_text: "BMO Field" },
      {
        client: createClient({
          ok: false,
          source: "mapbox_mcp",
          toolName: "search_and_geocode_tool",
          code: "not_configured",
          message: "missing token",
          raw: null,
        }),
      }
    );

    expect(result.status).toBe("unavailable");
    expect(result.error).toBe("missing token");
  });

  it("normalizes a successful MCP response using geometry coordinates", async () => {
    const result = await geocodeWithMapboxMcp(
      {
        location_text: "BMO Field",
        city_context: "Toronto",
        country_context: "Canada",
      },
      {
        client: createClient({
          ok: true,
          source: "mapbox_mcp",
          toolName: "search_and_geocode_tool",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                features: [
                  {
                    place_name: "BMO Field, Toronto, Ontario",
                    mapbox_id: "mbx.123",
                    relevance: 0.98,
                    geometry: {
                      coordinates: [-79.4187, 43.6332],
                    },
                  },
                ],
              }),
            },
          ],
          raw: { ok: true },
        }),
      }
    );

    expect(result).toEqual({
      status: "success",
      source: "mapbox_mcp",
      query: "BMO Field, Toronto, Canada",
      coordinates: { lng: -79.4187, lat: 43.6332 },
      place_name: "BMO Field, Toronto, Ontario",
      confidence: 0.98,
      provider_place_id: "mbx.123",
      selected_match_text: "BMO Field, Toronto, Ontario",
      raw: { ok: true },
    });
  });

  it("normalizes a successful MCP response using alternate coordinate fields", async () => {
    const result = await geocodeWithMapboxMcp(
      { location_text: "Union Station" },
      {
        client: createClient({
          ok: true,
          source: "mapbox_mcp",
          toolName: "search_and_geocode_tool",
          content: [
            {
              type: "text",
              text: JSON.stringify([
                {
                  name: "Union Station",
                  id: "place.456",
                  coordinates: {
                    longitude: -79.3807,
                    latitude: 43.6453,
                  },
                },
              ]),
            },
          ],
          raw: { ok: true },
        }),
      }
    );

    expect(result).toEqual({
      status: "success",
      source: "mapbox_mcp",
      query: "Union Station",
      coordinates: { lng: -79.3807, lat: 43.6453 },
      place_name: "Union Station",
      confidence: 1,
      provider_place_id: "place.456",
      selected_match_text: "Union Station",
      raw: { ok: true },
    });
  });

  it("deduplicates city and country context when the location already includes them", async () => {
    const result = await geocodeWithMapboxMcp(
      {
        location_text: "110 University Ave W, Waterloo, Ontario, Canada",
        city_context: "Waterloo",
        country_context: "Canada",
      },
      {
        client: createClient({
          ok: true,
          source: "mapbox_mcp",
          toolName: "search_and_geocode_tool",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                features: [
                  {
                    place_name: "110 University Ave W, Waterloo, Ontario, Canada",
                    mapbox_id: "mbx.waterloo",
                    relevance: 0.99,
                    geometry: {
                      coordinates: [-80.5204, 43.4643],
                    },
                  },
                ],
              }),
            },
          ],
          raw: { ok: true },
        }),
      },
    );

    expect(result.query).toBe("110 University Ave W, Waterloo, Ontario, Canada");
  });

  it("prefers the most specific landmark/address match over a generic city result", async () => {
    const result = await geocodeWithMapboxMcp(
      {
        location_text: "CN Tower, 290 Bremner Blvd, Toronto, ON, Canada",
        city_context: "Toronto",
        country_context: "Canada",
      },
      {
        client: createClient({
          ok: true,
          source: "mapbox_mcp",
          toolName: "search_and_geocode_tool",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                features: [
                  {
                    place_name: "Toronto, Ontario, Canada",
                    mapbox_id: "mbx.generic_toronto",
                    relevance: 0.99,
                    geometry: {
                      coordinates: [-79.3832, 43.6532],
                    },
                  },
                  {
                    place_name: "CN Tower, 290 Bremner Blvd, Toronto, Ontario, Canada",
                    mapbox_id: "mbx.cn_tower",
                    relevance: 0.92,
                    geometry: {
                      coordinates: [-79.3871, 43.6426],
                    },
                  },
                ],
              }),
            },
          ],
          raw: { ok: true },
        }),
      },
    );

    expect(result.coordinates).toEqual({ lng: -79.3871, lat: 43.6426 });
    expect(result.provider_place_id).toBe("mbx.cn_tower");
    expect(result.selected_match_text).toContain("CN Tower");
  });

  it("returns error when the MCP response contains no usable matches", async () => {
    const result = await geocodeWithMapboxMcp(
      { location_text: "Unknown Place" },
      {
        client: createClient({
          ok: true,
          source: "mapbox_mcp",
          toolName: "search_and_geocode_tool",
          content: [{ type: "text", text: JSON.stringify({ features: [] }) }],
          raw: { ok: true },
        }),
      }
    );

    expect(result).toEqual({
      status: "error",
      source: "mapbox_mcp",
      query: "Unknown Place",
      raw: { ok: true },
      error: "Mapbox MCP returned no geocode matches.",
    });
  });

  it("returns error when the MCP call itself fails", async () => {
    const result = await geocodeWithMapboxMcp(
      { location_text: "BMO Field" },
      {
        client: createClient({
          ok: false,
          source: "mapbox_mcp",
          toolName: "search_and_geocode_tool",
          code: "upstream_error",
          message: "gateway failure",
          raw: { status: 502 },
        }),
      }
    );

    expect(result).toEqual({
      status: "error",
      source: "mapbox_mcp",
      query: "BMO Field",
      raw: { status: 502 },
      error: "gateway failure",
    });
  });
});
