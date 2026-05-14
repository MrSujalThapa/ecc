import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAPBOX_MCP_ENDPOINT,
  DEFAULT_MAPBOX_MCP_TIMEOUT_MS,
  getMapboxMcpAvailability,
  resolveMapboxMcpConfig,
  type MapboxMcpEnv,
} from "./mapboxToolConfig";

describe("mapboxToolConfig", () => {
  it("defaults to disabled hosted configuration when env is absent", () => {
    const env: MapboxMcpEnv = {};

    expect(resolveMapboxMcpConfig(env)).toEqual({
      enabled: false,
      transport: "hosted",
      endpoint: DEFAULT_MAPBOX_MCP_ENDPOINT,
      accessToken: null,
      timeoutMs: DEFAULT_MAPBOX_MCP_TIMEOUT_MS,
    });

    expect(getMapboxMcpAvailability(env)).toEqual({
      available: false,
      reason: "not_enabled",
      transport: "hosted",
      endpoint: DEFAULT_MAPBOX_MCP_ENDPOINT,
      hasAccessToken: false,
      timeoutMs: DEFAULT_MAPBOX_MCP_TIMEOUT_MS,
    });
  });

  it("resolves self-hosted configuration and timeout when provided", () => {
    const env: MapboxMcpEnv = {
      MAPBOX_MCP_ENABLED: "true",
      MAPBOX_MCP_URL: "http://localhost:8787/mcp",
      MAPBOX_ACCESS_TOKEN: "pk.test",
      MAPBOX_MCP_TIMEOUT_MS: "12000",
    };

    expect(resolveMapboxMcpConfig(env)).toEqual({
      enabled: true,
      transport: "self_hosted",
      endpoint: "http://localhost:8787/mcp",
      accessToken: "pk.test",
      timeoutMs: 12000,
    });

    expect(getMapboxMcpAvailability(env)).toEqual({
      available: true,
      reason: "enabled",
      transport: "self_hosted",
      endpoint: "http://localhost:8787/mcp",
      hasAccessToken: true,
      timeoutMs: 12000,
    });
  });

  it("reports missing token explicitly when MCP is enabled", () => {
    const env: MapboxMcpEnv = {
      MAPBOX_MCP_ENABLED: "true",
      MAPBOX_ACCESS_TOKEN: "   ",
    };

    expect(getMapboxMcpAvailability(env)).toEqual({
      available: false,
      reason: "missing_access_token",
      transport: "hosted",
      endpoint: DEFAULT_MAPBOX_MCP_ENDPOINT,
      hasAccessToken: false,
      timeoutMs: DEFAULT_MAPBOX_MCP_TIMEOUT_MS,
    });
  });
});
