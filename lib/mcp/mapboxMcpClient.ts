import type {
  MapboxMcpAvailability,
  MapboxMcpClient,
  MapboxMcpConfig,
  MapboxMcpToolCallRequest,
  MapboxMcpToolCallResult,
} from "@/lib/mcp/types";
import {
  getMapboxMcpAvailability,
  readMapboxMcpEnv,
  resolveMapboxMcpConfig,
  type MapboxMcpEnv,
} from "@/lib/tools/mapbox/mapboxToolConfig";

const buildDisabledResult = (
  request: MapboxMcpToolCallRequest,
  availability: MapboxMcpAvailability
): MapboxMcpToolCallResult => ({
  ok: false,
  source: "mapbox_mcp",
  toolName: request.toolName,
  code:
    availability.reason === "missing_access_token"
      ? "not_configured"
      : "disabled",
  message:
    availability.reason === "missing_access_token"
      ? "Mapbox MCP is enabled but MAPBOX_ACCESS_TOKEN is missing."
      : "Mapbox MCP is disabled. Enable MAPBOX_MCP_ENABLED=true to use it.",
  raw: null,
});

const buildNotImplementedResult = (
  request: MapboxMcpToolCallRequest
): MapboxMcpToolCallResult => ({
  ok: false,
  source: "mapbox_mcp",
  toolName: request.toolName,
  code: "not_implemented",
  message:
    "Mapbox MCP transport is scaffolded but not implemented in Phase 8. Phase 9 will add live tool calls.",
  raw: null,
});

class ScaffoldMapboxMcpClient implements MapboxMcpClient {
  constructor(private readonly env: MapboxMcpEnv = readMapboxMcpEnv()) {}

  getConfig(): MapboxMcpConfig {
    return resolveMapboxMcpConfig(this.env);
  }

  getAvailability(): MapboxMcpAvailability {
    return getMapboxMcpAvailability(this.env);
  }

  async callTool(
    request: MapboxMcpToolCallRequest
  ): Promise<MapboxMcpToolCallResult> {
    const availability = this.getAvailability();

    if (!availability.available) {
      return buildDisabledResult(request, availability);
    }

    return buildNotImplementedResult(request);
  }
}

export const createMapboxMcpClient = (
  env: MapboxMcpEnv = readMapboxMcpEnv()
): MapboxMcpClient => new ScaffoldMapboxMcpClient(env);
