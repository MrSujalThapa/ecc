import { describe, expect, it, vi } from "vitest";
import { createMapboxMcpClient } from "./mapboxMcpClient";

describe("createMapboxMcpClient", () => {
  it("returns a disabled result when MCP is not enabled", async () => {
    const client = createMapboxMcpClient({});

    await expect(
      client.callTool({
        toolName: "search_and_geocode_tool",
        arguments: { query: "BMO Field" },
      })
    ).resolves.toEqual({
      ok: false,
      source: "mapbox_mcp",
      toolName: "search_and_geocode_tool",
      code: "disabled",
      message: "Mapbox MCP is disabled. Enable MAPBOX_MCP_ENABLED=true to use it.",
      raw: null,
    });
  });

  it("returns a misconfigured result when enabled but missing token", async () => {
    const client = createMapboxMcpClient({
      MAPBOX_MCP_ENABLED: "true",
    });

    await expect(
      client.callTool({
        toolName: "search_and_geocode_tool",
        arguments: { query: "BMO Field" },
      })
    ).resolves.toEqual({
      ok: false,
      source: "mapbox_mcp",
      toolName: "search_and_geocode_tool",
      code: "not_configured",
      message: "Mapbox MCP is enabled but MAPBOX_ACCESS_TOKEN is missing.",
      raw: null,
    });
  });

  it("posts JSON-RPC tools/call and returns normalized success", async () => {
    const fetchImpl = vi.fn(async (input, init) => {
      expect(input).toBe("https://mcp.mapbox.com/mcp");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer pk.test",
      });

      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "search_and_geocode_tool",
          arguments: { query: "BMO Field" },
        },
      });

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  features: [
                    {
                      place_name: "BMO Field, Toronto, Ontario",
                    },
                  ],
                }),
              },
            ],
          },
        }),
      } as Response;
    });

    const client = createMapboxMcpClient(
      {
        MAPBOX_MCP_ENABLED: "true",
        MAPBOX_ACCESS_TOKEN: "pk.test",
      },
      fetchImpl as typeof fetch
    );

    await expect(
      client.callTool({
        toolName: "search_and_geocode_tool",
        arguments: { query: "BMO Field" },
        requestId: "req-1",
      })
    ).resolves.toEqual({
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
              },
            ],
          }),
        },
      ],
      raw: {
        jsonrpc: "2.0",
        id: "req-1",
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                features: [
                  {
                    place_name: "BMO Field, Toronto, Ontario",
                  },
                ],
              }),
            },
          ],
        },
      },
    });
  });

  it("returns an upstream error result for non-2xx HTTP responses", async () => {
    const client = createMapboxMcpClient(
      {
        MAPBOX_MCP_ENABLED: "true",
        MAPBOX_ACCESS_TOKEN: "pk.test",
      },
      vi.fn(async () => ({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: async () => ({ detail: "gateway error" }),
      })) as typeof fetch
    );

    await expect(
      client.callTool({
        toolName: "search_and_geocode_tool",
        arguments: { query: "BMO Field" },
      })
    ).resolves.toEqual({
      ok: false,
      source: "mapbox_mcp",
      toolName: "search_and_geocode_tool",
      code: "upstream_error",
      message: "Mapbox MCP request failed with HTTP 502.",
      raw: { detail: "gateway error" },
    });
  });

  it("returns an upstream error result for MCP error payloads", async () => {
    const client = createMapboxMcpClient(
      {
        MAPBOX_MCP_ENABLED: "true",
        MAPBOX_ACCESS_TOKEN: "pk.test",
      },
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          jsonrpc: "2.0",
          error: { code: -32000, message: "tool failed" },
        }),
      })) as typeof fetch
    );

    await expect(
      client.callTool({
        toolName: "search_and_geocode_tool",
        arguments: { query: "BMO Field" },
      })
    ).resolves.toEqual({
      ok: false,
      source: "mapbox_mcp",
      toolName: "search_and_geocode_tool",
      code: "upstream_error",
      message: "tool failed",
      raw: {
        jsonrpc: "2.0",
        error: { code: -32000, message: "tool failed" },
      },
    });
  });

  it("returns an invalid_response result for malformed payloads", async () => {
    const client = createMapboxMcpClient(
      {
        MAPBOX_MCP_ENABLED: "true",
        MAPBOX_ACCESS_TOKEN: "pk.test",
      },
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ jsonrpc: "2.0", result: {} }),
      })) as typeof fetch
    );

    await expect(
      client.callTool({
        toolName: "search_and_geocode_tool",
        arguments: { query: "BMO Field" },
      })
    ).resolves.toEqual({
      ok: false,
      source: "mapbox_mcp",
      toolName: "search_and_geocode_tool",
      code: "invalid_response",
      message: "Mapbox MCP response did not include result.content.",
      raw: { jsonrpc: "2.0", result: {} },
    });
  });
});
