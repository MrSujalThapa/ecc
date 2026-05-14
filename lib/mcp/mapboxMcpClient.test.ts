import { describe, expect, it } from "vitest";
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

  it("returns a scaffold not_implemented result when enabled and configured", async () => {
    const client = createMapboxMcpClient({
      MAPBOX_MCP_ENABLED: "true",
      MAPBOX_ACCESS_TOKEN: "pk.test",
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
      code: "not_implemented",
      message:
        "Mapbox MCP transport is scaffolded but not implemented in Phase 8. Phase 9 will add live tool calls.",
      raw: null,
    });
  });
});
