# Agentic AI Upgrade Plan

## Purpose

This document explains the upgraded AI architecture for the AI Emergency Operations Platform.

The goal is to make the project more impressive and useful without breaking the current working MVP. The upgrade changes the AI layer from a simple transcript classifier into a controlled, tool-using emergency operations assistant.

The key rule remains:

```text
AI reasons and requests.
Backend validates.
Backend executes safe tools.
Database stores truth.
Dashboard visualizes.
Operator can override.
```

The AI agent must never directly mutate Supabase, Twilio, ElevenLabs, Mapbox, or production emergency workflows.

---

## Current Working Architecture

The current working MVP already has a safe architecture:

```text
Caller transcript
→ runCallTriageAgent
→ validated JSON output
→ backend merges Incident / CallSession patch
→ database or in-memory fallback stores state
→ dashboard fetches Incident data
→ Mapbox visualizes pins and incident details
```

Current provider path:

```text
AI_PROVIDER=mock
  → deterministic mock agent

AI_PROVIDER=gemma
  → current real-provider testing path

AI_PROVIDER=featherless
  → intended hackathon/provider path once API access is ready
```

This is useful but still basic. The AI mostly classifies, summarizes, and returns structured state patches.

---

## New Upgraded Architecture

The upgraded architecture adds **safe backend tools** that the Featherless-powered agents can request.

```text
Transcript / active incident state
→ Featherless agent first pass
→ structured tool_requests
→ backend validates tool requests
→ backend executes allowed tools
→ tool_results
→ Featherless agent second pass
→ final structured output
→ backend validates final output
→ database update
→ dashboard visualization
```

This makes the system much more useful in all three modes:

1. **Normal Mode** — triage, geocoding, low-risk report completion, SMS summaries.
2. **Disaster Mode** — clustering, route/resource recommendations, blocked-road awareness, prioritization.
3. **World Cup / Event Surge Mode** — multilingual triage, event-zone lookup, nearest help-point recommendations, route guidance, tourist assistance.

---

## What Changes and What Does Not Change

### What changes

- Agents can request safe backend tools.
- Backend can execute Mapbox MCP / Mapbox API / mock-data tools.
- Agents can reason over tool results.
- Surge / GeoOps intelligence becomes more useful.
- The dashboard can eventually display route lines, help points, event-zone matches, responder recommendations, language badges, SMS status, and tool confidence.

### What does not change

- Backend owns state changes.
- AI output must be schema-validated.
- The frontend dashboard does not call Featherless.
- The frontend dashboard does not call runtime Mapbox MCP.
- Operators remain in control.
- Existing Phase 1/2 dashboard work remains valid.
- Existing `/api/dev/incidents`, `/api/operator/*`, `/api/simulate/*`, and `/api/responders/mock` flows remain useful.

---

## Mapbox MCP Usage

There are two Mapbox MCP concepts:

```text
Mapbox DevKit MCP
  → helps Cursor write/debug Mapbox frontend code.

Mapbox runtime MCP / Mapbox MCP Server
  → backend-side access to geocoding, directions, routing, isochrones, place lookup, and other Mapbox services.
```

For this upgrade, the important one is the **runtime Mapbox MCP Server**.

The runtime Mapbox MCP must be used server-side through backend tool executors, not directly from the React dashboard.

Correct pattern:

```text
Featherless agent requests route_between_points
→ backend validates request
→ backend calls Mapbox MCP / Mapbox API wrapper
→ backend normalizes result
→ agent receives ToolResult
→ backend validates final recommendation
→ dashboard renders route/recommendation
```

Incorrect pattern:

```text
Frontend calls Mapbox MCP directly.
LLM freely controls Mapbox.
LLM directly assigns responders or dispatches help.
```

---

## Safe Tool Registry

The backend should expose a controlled registry of allowed tools.

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
sms_draft
context_lookup
```

Each tool must have:

```text
- strict input schema
- strict output schema
- mode restrictions if needed
- failure behavior
- audit logging if it affects decisions
- mock fallback for demos
```

---

## RAG-Lite / Structured Context

Do not build a complex vector database first.

For this hackathon, use **RAG-lite**:

```text
mode + incident type + location
→ deterministic context lookup
→ small context pack
→ Featherless prompt
```

Good context sources:

```text
World Cup venue zones
medical tents
police/security tents
lost-and-found centers
tourist help points
blocked roads
responder mock locations
shelters / safe zones
SMS templates
operator SOP snippets
```

This can be implemented using JSON, static files, database rows, or spreadsheet-backed mock data.

Vector RAG can be added later for larger SOPs, venue manuals, or multilingual policy documents.

---

## Mode-Specific Agent Behavior

## Normal Mode

The agent should:

```text
- classify urgency
- identify whether AI can continue
- collect missing fields
- geocode location if mentioned
- complete low-risk reports when enough information is collected
- create factual SMS summary/reference if appropriate
- escalate urgent/critical situations to an operator
```

Examples:

```text
stolen bike
lost laptop
minor report
suspicious activity
car issue / stranded caller
```

## Disaster Mode

The agent should:

```text
- prioritize life-safety incidents
- detect clusters and repeated reports
- use blocked-road / impact-zone context
- recommend nearby resources
- recommend route lines or travel-time estimates
- identify which incidents operators should handle first
```

Do not build full autonomous dispatch. Show recommendations for operator confirmation.

## World Cup / Event Surge Mode

The agent should:

```text
- detect caller language
- triage severity
- identify stadium/fan-zone/event-area context
- direct low-risk callers to nearest help point
- escalate medical/security/lost-person risks
- create multilingual SMS summaries/directions if appropriate
```

Examples:

```text
lost child near fan zone
medical issue near Gate 3
crowd pushing near stadium entrance
tourist lost near transit hub
phone stolen near fan zone
```

---

## Team Ownership

## Member 1 — Fullstack / Tool Runtime

Owns:

```text
- backend tool registry
- Mapbox MCP backend wrapper
- mock fallback tools
- ToolResult normalization
- audit logging
- integration with call-turn pipeline
- future /api/surge/analyze
```

Does not own:

```text
- AI prompts
- dashboard UI
- Mapbox frontend styling
```

## Member 3 — Featherless / AI Agents

Owns:

```text
- Featherless provider wrapper
- controlled agent runtime
- Call Triage Agent v2
- Surge / GeoOps Agent
- tool request schema
- tool-results reasoning pass
- multilingual behavior
- SMS draft output
- fallback behavior
```

Does not own:

```text
- executing Mapbox MCP directly without backend validation
- database mutations
- frontend visualization
```

## Member 4 — Mapbox / Dashboard UX

Owns:

```text
- visualizing typed backend outputs
- route line layers
- help-point/event-zone display
- responder recommendation display
- cluster/priority display
- language/SMS/tool-status UI
```

Does not own:

```text
- Featherless calls
- runtime Mapbox MCP calls
- backend tool execution
- AI schemas
```

---

## Build Sequence

### Step 1 — Docs and contract proposal

Create:

```text
docs/agentic_ai_upgrade_plan.md
docs/featherless_old_vs_new_architecture.md
docs/api_contracts_agentic_proposal.md
docs/team/member1_agentic_tool_runtime_plan.md
docs/team/member3_featherless_tool_agent_plan.md
docs/team/member4_agentic_dashboard_integration_plan.md
```

Update:

```text
docs/project_details.md
docs/project_plan.md
```

Do not replace `docs/api_contracts.md` yet.

### Step 2 — Member 1 backend tool runtime

Build mock-first tool executors and safe tool registry.

### Step 3 — Member 3 Featherless agent upgrade

Build provider wrapper, schemas, prompt updates, and controlled tool-request behavior.

### Step 4 — Member 4 dashboard visualization

Continue current phases using existing APIs and mock/fallback data. Later integrate typed outputs from Member 1/3.

### Step 5 — Integration slice

```text
final transcript
→ agent tool request
→ backend tool execution
→ validated update
→ dashboard visualization
```

---

## What Not To Build First

Do not build these first:

```text
full autonomous dispatch
real production emergency integration
complex vector RAG
natural-language operator map chat
live audio streaming to dashboard
full route optimization
direct frontend access to Featherless or runtime Mapbox MCP
```

Build the controlled tool layer first.

---

## Success Criteria

The upgrade is successful when:

```text
- existing MVP still works
- mock provider still works
- Gemma/Featherless provider can fall back safely
- AI outputs are schema-validated
- tool requests are validated before execution
- tool results are normalized
- dashboard can visualize recommendations without owning backend logic
- operators can override decisions
- no teammate has to rewrite their entire workstream
```
