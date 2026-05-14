import type {
  MapboxMcpAvailability,
  MapboxMcpConfig,
  MapboxMcpTransport,
} from "@/lib/mcp/types";

export const DEFAULT_MAPBOX_MCP_ENDPOINT = "https://mcp.mapbox.com/mcp";
export const DEFAULT_MAPBOX_MCP_TIMEOUT_MS = 5_000;

export type MapboxMcpEnv = Partial<
  Pick<
    NodeJS.ProcessEnv,
  "MAPBOX_MCP_ENABLED" | "MAPBOX_MCP_URL" | "MAPBOX_ACCESS_TOKEN" | "MAPBOX_MCP_TIMEOUT_MS"
  >
>;

export const readMapboxMcpEnv = (
  env: NodeJS.ProcessEnv = process.env
): MapboxMcpEnv => ({
  MAPBOX_MCP_ENABLED: env.MAPBOX_MCP_ENABLED,
  MAPBOX_MCP_URL: env.MAPBOX_MCP_URL,
  MAPBOX_ACCESS_TOKEN: env.MAPBOX_ACCESS_TOKEN,
  MAPBOX_MCP_TIMEOUT_MS: env.MAPBOX_MCP_TIMEOUT_MS,
});

const normalizeOptionalString = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const parseTimeout = (value: string | undefined): number => {
  const raw = value?.trim();
  if (!raw) return DEFAULT_MAPBOX_MCP_TIMEOUT_MS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAPBOX_MCP_TIMEOUT_MS;
  }

  return Math.floor(parsed);
};

const resolveTransport = (endpoint: string): MapboxMcpTransport =>
  endpoint === DEFAULT_MAPBOX_MCP_ENDPOINT ? "hosted" : "self_hosted";

export const resolveMapboxMcpConfig = (
  env: MapboxMcpEnv = readMapboxMcpEnv()
): MapboxMcpConfig => {
  const endpoint =
    normalizeOptionalString(env.MAPBOX_MCP_URL) ?? DEFAULT_MAPBOX_MCP_ENDPOINT;
  const accessToken = normalizeOptionalString(env.MAPBOX_ACCESS_TOKEN);
  const enabled = env.MAPBOX_MCP_ENABLED?.trim() === "true";

  return {
    enabled,
    transport: resolveTransport(endpoint),
    endpoint,
    accessToken,
    timeoutMs: parseTimeout(env.MAPBOX_MCP_TIMEOUT_MS),
  };
};

export const getMapboxMcpAvailability = (
  env: MapboxMcpEnv = readMapboxMcpEnv()
): MapboxMcpAvailability => {
  const config = resolveMapboxMcpConfig(env);

  if (!config.enabled) {
    return {
      available: false,
      reason: "not_enabled",
      transport: config.transport,
      endpoint: config.endpoint,
      hasAccessToken: Boolean(config.accessToken),
      timeoutMs: config.timeoutMs,
    };
  }

  if (!config.accessToken) {
    return {
      available: false,
      reason: "missing_access_token",
      transport: config.transport,
      endpoint: config.endpoint,
      hasAccessToken: false,
      timeoutMs: config.timeoutMs,
    };
  }

  return {
    available: true,
    reason: "enabled",
    transport: config.transport,
    endpoint: config.endpoint,
    hasAccessToken: true,
    timeoutMs: config.timeoutMs,
  };
};
