# Member 1 Addendum — Agentic Tool Runtime Plan

## Purpose

This file is an addendum to:

```text
docs/team/member1_fullstack_integration.md
```

It explains what changes for Member 1 because the project is upgrading from simple AI triage output to **controlled tool-using agents** powered by Featherless and backend-executed Mapbox/tool calls.

This file does not replace the current Member 1 status file. It is the roadmap for the new backend tool runtime work.

---

## Member 1 Role In The Upgrade

Member 1 owns the backend execution boundary.

The AI agent may request tools, but Member 1's backend code validates and executes those tools.

```text
AI requests
→ backend validates
→ backend executes
→ backend normalizes result
→ backend persists/audits
```

Member 1 must keep the backend safe, typed, auditable, and compatible with the existing MVP.

---

## Read Before Coding

Use these docs as source of truth:

```text
docs/project_details.md
docs/project_plan.md
docs/api_contracts.md
docs/api_contracts_agentic_proposal.md
docs/agentic_ai_upgrade_plan.md
docs/featherless_old_vs_new_architecture.md
docs/team/member1_fullstack_integration.md
docs/team/member1_agentic_tool_runtime_plan.md
```

Do not change frontend dashboard code unless explicitly assigned.

---

## What Already Exists

The current backend already has:

```text
- shared domain/API types
- call/session API endpoints
- operator endpoints
- simulation endpoints
- responder mock endpoint
- dev incident listing
- Supabase service-role persistence when configured
- in-memory fallback persistence
- mock/Gemma AI provider routing
```

Important known gaps:

```text
- lib/tools/* executors are not fully built
- runtime Mapbox MCP integration is not built
- /api/surge/analyze is not implemented
- real Featherless provider path is not complete
- real Twilio/ElevenLabs/SMS production paths are not complete
```

---

## Core Responsibility

Build the safe backend tool runtime.

Member 1 owns:

```text
/lib/tools/*
/lib/ai/toolRegistry.ts
/lib/ai/executeAllowedToolRequests.ts
/lib/ai/toolResults.ts
/lib/server/tool-audit helpers if needed
future /app/api/surge/analyze/route.ts
```

Member 1 does not own:

```text
AI prompts
Featherless prompt tuning
Mapbox dashboard UI
incident card/drawer styling
voice provider setup
```

---

## Required Backend Pattern

```text
Agent output contains tool_requests
→ validate ToolRequest[]
→ execute only allowed tools
→ return ToolResult[]
→ optionally run agent second pass
→ validate final agent output
→ update Incident / CallSession
→ append AuditLog
```

Never allow raw LLM output to directly:

```text
- mutate Supabase
- call Twilio
- call ElevenLabs
- send SMS
- dispatch responders
- control Mapbox
```

---

## Tool Registry

Create a typed registry of allowed tools.

Suggested file:

```text
/lib/ai/toolRegistry.ts
```

Suggested tools:

```text
geocode_location
reverse_geocode
event_zone_lookup
nearest_help_point_lookup
responder_lookup
route_between_points
travel_time_matrix
isochrone_lookup
context_lookup
sms_draft
```

Each tool should define:

```text
- name
- input validation schema
- allowed modes
- executor function
- output normalization
- failure behavior
```

---

## Tool Execution Helper

Suggested file:

```text
/lib/ai/executeAllowedToolRequests.ts
```

Suggested function:

```ts
export async function executeAllowedToolRequests(input: {
  mode: SystemMode;
  incident: Incident;
  callSession: CallSession;
  requests: ToolRequest[];
  context: AgentContextPack;
}): Promise<ToolResult[]>;
```

Rules:

```text
- reject unknown tools
- validate args by tool
- block unsafe tools in wrong modes
- execute mock fallback when runtime provider is unavailable
- normalize all results
- never return raw provider objects directly
- log/audit important tool usage
```

---

## Mapbox MCP / Mapbox API Runtime

Mapbox runtime tools should be server-side only.

Suggested file:

```text
/lib/tools/mapboxRuntimeClient.ts
```

Implementation can use:

```text
- Mapbox MCP server
- direct Mapbox APIs
- mock fallback data
```

For the hackathon, mock fallback is acceptable and recommended.

Backend tools that may use Mapbox:

```text
geocode_location
reverse_geocode
route_between_points
travel_time_matrix
isochrone_lookup
```

Do not expose private/server Mapbox tokens to the browser.

---

## Mock Fallback Tools

To keep the demo reliable, every runtime tool should have a mock fallback.

Suggested files:

```text
/lib/tools/mockGeocoding.ts
/lib/tools/mockEventZones.ts
/lib/tools/mockHelpPoints.ts
/lib/tools/mockResponders.ts
/lib/tools/mockRoutes.ts
```

Mock data can be backed by:

```text
static JSON
TypeScript objects
spreadsheet-exported JSON
database seed data later
```

---

## Event / Help Point Lookup

World Cup mode needs structured context for:

```text
stadium perimeter
fan zones
medical tents
police/security tents
lost-and-found centers
tourist help points
transit nodes
restricted zones
crowd-density zones
road closures
```

Disaster mode needs context for:

```text
impact zones
blocked roads
responder staging areas
shelters / safe zones
resource points
```

These should initially be static/mock lookup tools.

---

## Call Turn Integration

Existing `/api/call/turn` flow should be extended carefully.

New target:

```text
save transcript
→ run agent first pass
→ validate tool requests
→ execute allowed tools
→ run optional second pass with tool results
→ validate final output
→ merge incident/session patches
→ audit
→ return response
```

Do not break the existing mock/Gemma provider flow. If tools fail, fallback safely.

---

## Surge Analyze Endpoint

Eventually implement:

```text
POST /api/surge/analyze
```

This endpoint should:

```text
- load active incidents
- load responders
- load event/disaster layers
- run Surge / GeoOps Agent
- validate output
- persist priority_score / cluster_id when appropriate
- return clusters and recommendations
```

For first version, route recommendations and clusters can be mock or frontend-derived. Do not block dashboard work on this.

---

## Phased Roadmap

## Phase M1-A — Tool Contracts and Runtime Skeleton

Build:

```text
/lib/ai/toolRegistry.ts
/lib/ai/executeAllowedToolRequests.ts
/lib/ai/toolResults.ts
```

Requirements:

```text
- no provider dependency yet
- mock executors allowed
- strict validation
- tests for rejected unknown tools
```

## Phase M1-B — Mock Tool Executors

Build:

```text
geocode_location
event_zone_lookup
nearest_help_point_lookup
responder_lookup
route_between_points
context_lookup
sms_draft
```

Requirements:

```text
- works without Mapbox MCP
- uses fake event/responder/help-point data
- returns normalized ToolResult objects
```

## Phase M1-C — Mapbox Runtime Integration

Build:

```text
Mapbox MCP / Mapbox API wrapper
server-side env handling
fallback if provider unavailable
```

Requirements:

```text
- no frontend exposure of private tokens
- tool args stripped of unnecessary personal info
- graceful failure
```

## Phase M1-D — Call Turn Tool Loop

Integrate:

```text
first pass agent output
→ tool_requests
→ executeAllowedToolRequests
→ second pass with tool_results
```

Requirements:

```text
- existing mock provider still works
- invalid tool output does not break call flow
- backend validation remains final authority
```

## Phase M1-E — Surge Analyze Route

Build:

```text
POST /api/surge/analyze
```

Requirements:

```text
- can run with mock data
- returns SurgeCluster[] and recommendations
- does not require production Featherless to demo
```

## Phase M1-F — Hardening

Add:

```text
tests
audit logs
timeouts
rate limits if needed
error handling
fallback behavior
```

---

## Definition of Done

A Member 1 agentic tool runtime phase is done when:

```text
- existing API routes still work
- mock/demo path still works
- unknown tools are rejected
- malformed tool args are rejected
- tool failures do not crash call flow
- normalized ToolResult objects are returned
- sensitive tokens are not exposed
- audit logs are created for important decisions
- tests or targeted checks pass
- docs are updated
```

---

## Cursor Prompt Template

```text
I am Team Member 1: Fullstack / Integration.

Read:
- docs/project_details.md
- docs/project_plan.md
- docs/api_contracts.md
- docs/api_contracts_agentic_proposal.md
- docs/agentic_ai_upgrade_plan.md
- docs/team/member1_fullstack_integration.md
- docs/team/member1_agentic_tool_runtime_plan.md

Build only the requested Member 1 tool-runtime phase.
Do not edit dashboard UI, AI prompts, voice setup, or unrelated files.
Preserve existing contracts unless this task explicitly updates the proposed agentic contracts.
Keep existing mock/demo paths working.
Use backend validation before executing any tool request.
```
