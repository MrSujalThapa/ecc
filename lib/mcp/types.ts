export type MapboxMcpTransport = "hosted" | "self_hosted";

export type MapboxMcpAvailabilityReason =
  | "enabled"
  | "not_enabled"
  | "missing_access_token";

export type MapboxMcpConfig = {
  enabled: boolean;
  transport: MapboxMcpTransport;
  endpoint: string;
  accessToken: string | null;
  timeoutMs: number;
};

export type MapboxMcpAvailability = {
  available: boolean;
  reason: MapboxMcpAvailabilityReason;
  transport: MapboxMcpTransport;
  endpoint: string;
  hasAccessToken: boolean;
  timeoutMs: number;
};

export type MapboxMcpToolCallRequest = {
  toolName: string;
  arguments: Record<string, unknown>;
  timeoutMs?: number;
  requestId?: string;
};

export type MapboxMcpToolCallSuccess = {
  ok: true;
  source: "mapbox_mcp";
  toolName: string;
  content: unknown;
  raw: unknown;
};

export type MapboxMcpToolCallFailureCode =
  | "disabled"
  | "not_configured"
  | "upstream_error"
  | "invalid_response";

export type MapboxMcpToolCallFailure = {
  ok: false;
  source: "mapbox_mcp";
  toolName: string;
  code: MapboxMcpToolCallFailureCode;
  message: string;
  raw: unknown;
};

export type MapboxMcpToolCallResult =
  | MapboxMcpToolCallSuccess
  | MapboxMcpToolCallFailure;

export type MapboxMcpFetch = typeof fetch;

export type MapboxMcpClient = {
  getConfig: () => MapboxMcpConfig;
  getAvailability: () => MapboxMcpAvailability;
  callTool: (
    request: MapboxMcpToolCallRequest
  ) => Promise<MapboxMcpToolCallResult>;
};
