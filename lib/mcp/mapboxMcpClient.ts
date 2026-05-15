import type {
  MapboxMcpAvailability,
  MapboxMcpClient,
  MapboxMcpConfig,
  MapboxMcpFetch,
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
      ? "Mapbox MCP is enabled but MAPBOX_ACCESS_TOKEN is missing. Backend geocoding requires MAPBOX_MCP_ENABLED=true and MAPBOX_ACCESS_TOKEN; NEXT_PUBLIC_MAPBOX_TOKEN only renders the frontend map."
      : "Mapbox MCP is disabled. Enable MAPBOX_MCP_ENABLED=true to use backend geocoding. NEXT_PUBLIC_MAPBOX_TOKEN only renders the frontend map.",
  raw: null,
});

const buildFailureResult = (
  request: MapboxMcpToolCallRequest,
  code: "upstream_error" | "invalid_response",
  message: string,
  raw: unknown
): MapboxMcpToolCallResult => ({
  ok: false,
  source: "mapbox_mcp",
  toolName: request.toolName,
  code,
  message,
  raw,
});

type MapboxJsonRpcSuccess = {
  result?: {
    content?: unknown;
  };
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

const isJsonRpcResponse = (value: unknown): value is MapboxJsonRpcSuccess =>
  typeof value === "object" && value !== null;

class RuntimeMapboxMcpClient implements MapboxMcpClient {
  constructor(
    private readonly env: MapboxMcpEnv = readMapboxMcpEnv(),
    private readonly fetchImpl: MapboxMcpFetch = fetch
  ) {}

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
    const config = this.getConfig();

    if (!availability.available) {
      return buildDisabledResult(request, availability);
    }

    const controller = new AbortController();
    const timeoutMs = request.timeoutMs ?? config.timeoutMs;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchImpl(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: request.requestId ?? `mapbox-mcp-${Date.now()}`,
          method: "tools/call",
          params: {
            name: request.toolName,
            arguments: request.arguments,
          },
        }),
        signal: controller.signal,
      });

      let raw: unknown;
      try {
        raw = await response.json();
      } catch (error) {
        return buildFailureResult(
          request,
          "invalid_response",
          "Mapbox MCP returned a non-JSON response.",
          {
            status: response.status,
            statusText: response.statusText,
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }

      if (!response.ok) {
        return buildFailureResult(
          request,
          "upstream_error",
          `Mapbox MCP request failed with HTTP ${response.status}.`,
          raw
        );
      }

      if (!isJsonRpcResponse(raw)) {
        return buildFailureResult(
          request,
          "invalid_response",
          "Mapbox MCP returned an invalid JSON-RPC payload.",
          raw
        );
      }

      if (raw.error) {
        return buildFailureResult(
          request,
          "upstream_error",
          raw.error.message || "Mapbox MCP returned an error payload.",
          raw
        );
      }

      if (!("result" in raw) || !raw.result || !("content" in raw.result)) {
        return buildFailureResult(
          request,
          "invalid_response",
          "Mapbox MCP response did not include result.content.",
          raw
        );
      }

      return {
        ok: true,
        source: "mapbox_mcp",
        toolName: request.toolName,
        content: raw.result.content,
        raw,
      };
    } catch (error) {
      return buildFailureResult(
        request,
        "upstream_error",
        error instanceof Error ? error.message : "Mapbox MCP request failed.",
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const createMapboxMcpClient = (
  env: MapboxMcpEnv = readMapboxMcpEnv(),
  fetchImpl: MapboxMcpFetch = fetch
): MapboxMcpClient => new RuntimeMapboxMcpClient(env, fetchImpl);
