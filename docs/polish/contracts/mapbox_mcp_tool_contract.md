# Mapbox MCP Tool Contract (Phase 8 Scaffold)

## Purpose

Phase 8 adds a backend-safe scaffold for future Mapbox MCP-backed tools without changing the current triage runtime. The current registry and dispatcher stay on the existing mock/static executors until later phases wire real adapters in.

## Scaffold Layers

### `lib/mcp/*`

- `lib/mcp/types.ts` defines the typed broker contract for future backend MCP calls.
- `lib/mcp/mapboxMcpClient.ts` is a safe-off scaffold client.
- The Phase 8 client must never make the app depend on MCP env/config being present.

### `lib/tools/mapbox/*`

- `lib/tools/mapbox/mapboxToolConfig.ts` centralizes env/config defaults.
- `lib/tools/mapbox/types.ts` defines future adapter-facing result types aligned with `ToolResult`.
- Phase 8 does not register or execute any new Mapbox-backed tool.

## Configuration Expectations

Phase 8 uses these server-side env expectations:

- `MAPBOX_MCP_ENABLED`
- `MAPBOX_MCP_URL`
- `MAPBOX_ACCESS_TOKEN`
- `MAPBOX_MCP_TIMEOUT_MS`

Defaults:

- `MAPBOX_MCP_ENABLED !== "true"` means MCP is disabled.
- `MAPBOX_MCP_URL` defaults to the hosted endpoint: `https://mcp.mapbox.com/mcp`
- `MAPBOX_MCP_TIMEOUT_MS` defaults to `5000`
- Missing `MAPBOX_ACCESS_TOKEN` keeps MCP unavailable even if enabled.

## Safe Default Behavior

- When MCP is disabled, helper APIs should report that state cleanly.
- When MCP is enabled but misconfigured, helper APIs should report an explicit configuration problem.
- Even when MCP is enabled and configured, Phase 8 transport remains scaffold-only and should not be wired into current triage tool execution yet.
- Existing mock tools remain the authoritative runtime behavior in Phase 8.

## Normalized Result Expectations

Future Mapbox-backed tool adapters should normalize their outputs into the existing backend tool result model in `lib/ai/toolResults.ts`.

Expected source values already supported:

- `mapbox_mcp`
- `mapbox_api`

Expected adapter behavior:

- Success results should provide the same shape current callers already expect for each tool.
- Failure results should map to backend-safe tool errors rather than leaking raw MCP response details directly into triage behavior.
- Fallback policy must stay explicit so later phases can choose between returning a tool error and preserving the existing mock executor.

## Phase 9 and Phase 10 Handoff

### Phase 9

Implement the real MCP transport and the first backend-safe Mapbox geocode/search adapter behind this scaffold.

Recommended Phase 9 work:

- replace the scaffold `not_implemented` transport path with real HTTP MCP calls
- validate timeout/error handling
- add adapter logic for geocode/search normalization
- keep the adapter unregistered until behavior is proven

### Phase 10

Replace the current `geocode_location` mock executor in `toolRegistry` with the new Mapbox-backed adapter, while preserving safe fallback behavior when MCP is unavailable.

Phase 10 should not redesign the scaffold; it should only wire the existing seam into the live executor path.
