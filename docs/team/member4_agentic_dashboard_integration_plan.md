# Member 4 Addendum — Agentic Dashboard Integration Plan

## Purpose

This file is an addendum to:

```text
docs/team/member4_mapbox_dashboard.md
```

It explains how Member 4 should continue building the dashboard while the team upgrades the backend/AI architecture to support Featherless tool-using agents and Mapbox MCP runtime tools.

This file does not replace the current Member 4 roadmap. It clarifies what changes later and what can be built now.

---

## Current Member 4 Status

Completed:

```text
Phase 1 — Dashboard Shell + Core Mapbox
Phase 2 — Data/Action Adapters
Phase 3 — Incident Queue + Incident Drawer UX
Phase 9 — API Operator Actions
Phase 8 — Demo Controls + Simulation Buttons
Phase 4 — Responder Visualization + Layer Controls
Phase 5 — Disaster Mode Layers
Phase 6 — Cluster Drawer
```

Phase 1 completed:

```text
- /dashboard route
- top bar / queue / Mapbox / drawer layout
- Mapbox renders
- 3D buildings/terrain render
- fallback incidents work
- incident pins render
- queue selection works
- map pin selection works
- selected incident appears in drawer
```

Phase 2 completed:

```text
- incident data source adapter
- API incident data source
- operator actions adapter
- API operator actions
- simulation client
- responders client
- DashboardShell now consumes data adapters
```

Phase 3 completed:

```text
- filtered/sorted incident queue
- reusable incident cards
- expanded incident drawer fields
- missing-field checklist
- transcript/audio availability panel
- operator action controls through existing OperatorActions adapters
- action loading/error/success states
- refetch after successful operator actions
```

Phase 9 completed:

```text
- hardened existing OperatorActions adapter error handling
- per-action loading state in operator controls
- clear error and success/neutral feedback
- honest sent=false handling for current SMS stub behavior
- refetch after successful operator actions
```

Phase 8 completed:

```text
- visible demo simulation controls
- disaster and world cup simulation buttons
- refresh incidents control
- reset view / clear selection control
- compact status metrics and operator load panel
- mode-aware demo control styling
- refetch after successful simulations
```

Phase 4 completed:

```text
- responders fetched through the Phase 2 responders client
- ambulance, fire, police, and event staff markers on Mapbox
- incident and responder layer toggles
- future layer toggles shown as disabled/coming later
- responder failures handled as non-blocking map messages
```

Phase 5 completed:

```text
- incident heatmap layer from visible incident coordinates
- local/mock surge cluster circle layer
- mock disaster impact zone polygons
- mock blocked road line layers
- disaster layer controls promoted from disabled to active
- no dependency on /api/surge/analyze
```

Phase 6 completed:

```text
- cluster drawer for selected frontend-derived/mock clusters
- cluster incident list links back to incident details
- map cluster click selection and selected-cluster highlight
- queue and pin selection clear cluster state
- no dependency on /api/surge/analyze
```

Important commit for Phase 2:

```text
feat(dashboard): add api data and action adapters
```

---

## Core Rule

Member 4 visualizes typed backend outputs.

Member 4 does **not** call:

```text
- Featherless
- Gemma
- runtime Mapbox MCP
- backend tool executors
- Supabase service-role clients
```

The dashboard consumes typed data from:

```text
existing APIs
future APIs
data/action adapters
mock/fallback data
```

---

## Read Before Coding

Use these docs:

```text
docs/project_details.md
docs/project_plan.md
docs/api_contracts.md
docs/api_contracts_agentic_proposal.md
docs/agentic_ai_upgrade_plan.md
docs/team/member4_mapbox_dashboard.md
docs/team/member4_agentic_dashboard_integration_plan.md
```

For Mapbox frontend implementation, also use:

```text
Mapbox DevKit MCP
installed Mapbox skills
```

---

## Immediate Roadmap

Build these now without waiting for Member 1 or Member 3.

```text
Phase 3 — Incident Queue + Incident Drawer UX
Phase 9 — API Operator Actions
Phase 8 — Demo Controls + Simulation Buttons
Phase 4 — Responder Visualization + Layer Controls
Phase 5 — Disaster Mode Layers
Phase 6 — Cluster Drawer
Phase 7 — World Cup / Event Surge Layers
Phase 11 — Final Demo Polish
```

Build these later:

```text
Phase 10 — Realtime Dashboard Integration
Phase 12 — Real Agentic GeoOps / Mapbox MCP Output Integration
```

Phase 10 waits for Member 1 Realtime readiness.

Phase 12 waits for Member 1 + Member 3 to implement backend tool runtime, Featherless tool-using agents, and accepted agentic API contracts.

---

## Why Phase 11 Before Phase 10

Phase 10 depends on Supabase Realtime/frontend subscription readiness.

Member 4 can still polish the demo before realtime by using:

```text
- existing API fetch/refetch
- in-memory fallback persistence
- simulation endpoints
- mock responder data
- mock event layers
- frontend-derived clusters
```

So Phase 11 can happen before Phase 10.

---

## What Member 4 Can Build Now

## Phase 3 — Queue + Drawer UX

Build now.

Future-ready fields to show if available:

```text
recommended_action
priority_score
cluster_id
mode
status
control_state
ai_active
operator_required
location_status
location_confidence
language badge later
SMS/tool status later
```

Do not wait for agentic backend outputs.

## Phase 9 — API Operator Actions

Build now using existing endpoints:

```text
POST /api/operator/takeover
POST /api/operator/update-incident
POST /api/operator/resolve
POST /api/operator/send-sms
```

Send SMS may be a stub. Still wire the UI to the adapter.

## Phase 8 — Demo Controls + Simulation Buttons

Build now using:

```text
POST /api/simulate/disaster
POST /api/simulate/world-cup
GET /api/dev/incidents
```

This helps test the dashboard before real voice/AI integrations are complete.

## Phase 4 — Responders + Layer Controls

Build now using:

```text
GET /api/responders/mock
```

Responder visualization will later be used by GeoOps recommendations.

## Phase 5 — Disaster Layers

Build now with mock/frontend-derived data:

```text
heatmap
cluster circles
impact zones
blocked roads
responder staging
```

Do not depend on `/api/surge/analyze` yet.

## Phase 6 — Cluster Drawer

Build now with mock/frontend-derived clusters.

Later, replace cluster source with backend `SurgeCluster[]`.

## Phase 7 — World Cup / Event Layers

Build now with mock EventLayer data:

```text
stadium perimeter
fan zones
medical tents
police/security tents
lost-and-found
tourist help
transit nodes
restricted zones
crowd-density zones
road closures
```

Later, these same layers support event_zone_lookup and nearest_help_point_lookup.

## Phase 11 — Demo Polish — Completed

Build before Phase 10 if realtime is not ready.

Focus:

```text
critical incidents obvious
map remains centerpiece
normal/disaster/world_cup visually distinct
layer toggles reduce clutter
operator understands priority in under 5 seconds
```

---

## What Member 4 Should Wait For

## Phase 10 — Realtime Dashboard Integration

~~Wait for Member 1 to confirm frontend Supabase Realtime readiness.~~

Build:

```text
~~supabaseIncidentDataSource~~
~~supabaseTranscriptDataSource~~
~~incident subscription~~
~~transcript_events subscription~~
~~live selected drawer updates~~
~~live map pin updates~~
```

## Phase 12 — Real Agentic GeoOps Integration

Wait for Member 1 + Member 3.

Requires:

```text
accepted api_contracts_agentic_proposal fields
backend tool runtime
Mapbox MCP or mock tool executors
Featherless tool-using agent outputs
/api/surge/analyze or equivalent
```

---

## Future Agentic Outputs To Visualize

Once Member 1 and Member 3 are ready, Member 4 should visualize:

```text
RouteRecommendation.geometry
HelpPointRecommendation
ResponderRecommendation
EventZoneMatch
GeoOpsRecommendation
SurgeCluster
LanguageState
SmsDraftState
ToolResult status/confidence
```

---

## Dashboard Components To Prepare

Possible future components:

```text
/components/map/RouteLayer.tsx
/components/map/HelpPointLayer.tsx
/components/incidents/RecommendationCard.tsx
/components/incidents/ToolStatusList.tsx
/components/incidents/LanguageBadge.tsx
/components/incidents/SmsStatusPanel.tsx
/components/incidents/HelpPointRecommendationPanel.tsx
/components/incidents/ResponderRecommendationPanel.tsx
```

Do not build all of these now. Add them only when needed by the current phase or integration target.

---

## Mapbox Visualization Rules

For future agentic outputs:

```text
- route geometry should be rendered as Mapbox line layers
- help points should be rendered as symbols or clean markers
- event zones should be rendered as fill/line layers
- responder recommendations should visually connect responder to incident only when useful
- large point sets should use GeoJSON layers, not hundreds of HTML markers
- map layers should not reinitialize the map
- all mode-specific layers should be toggleable
```

---

## Location-Agnostic Design

Toronto can remain the default demo viewport.

Reusable helpers should support:

```text
- computed bounds from incidents
- event centers
- simulation centers
- mode configuration
- non-Toronto coordinates
```

Avoid hardcoding Toronto in reusable map/layer helpers.

---

## Integration Stages

## Stage 1 — Existing APIs

Already available / build now:

```text
GET /api/dev/incidents
GET /api/responders/mock
POST /api/operator/*
POST /api/simulate/disaster
POST /api/simulate/world-cup
```

## Stage 2 — Mock GeoOps Dashboard

Build with mock/frontend data:

```text
disaster layers
event layers
clusters
route-line placeholders if needed
```

## Stage 3 — Agentic API Contract Accepted

Update adapters/types only after team accepts proposal.

## Stage 4 — Backend Tool Runtime Ready

Start consuming:

```text
route recommendations
help-point recommendations
event-zone matches
responder recommendations
tool status
```

## Stage 5 — Realtime Ready

Swap fetch/refetch adapters for Supabase Realtime adapters.

---

## Do Not Do

Member 4 should not:

```text
- call Featherless from React
- call Gemma from React
- call runtime Mapbox MCP from React
- add backend tool execution code
- modify /app/api/*
- modify /lib/ai/*
- modify /lib/db/*
- modify /lib/server/*
- modify /lib/supabase/*
- modify /lib/validation/*
- modify Supabase migrations
```

Unless explicitly assigned by the team.

---

## Definition of Done For Future Agentic Dashboard Work

A future agentic dashboard feature is done when:

```text
- /dashboard still loads
- Mapbox still renders
- existing pin/queue/drawer selection still works
- fallback data still works
- feature consumes typed backend/mock data
- no frontend calls to Featherless or runtime Mapbox MCP
- no backend/API internals changed by Member 4
- loading/empty/error states exist
- layer toggles prevent clutter
- targeted checks pass
- docs are updated
```

---

## Cursor Prompt Template

```text
I am Team Member 4: Mapbox + Dashboard UX.

Read:
- docs/project_details.md
- docs/project_plan.md
- docs/api_contracts.md
- docs/api_contracts_agentic_proposal.md
- docs/agentic_ai_upgrade_plan.md
- docs/team/member4_mapbox_dashboard.md
- docs/team/member4_agentic_dashboard_integration_plan.md

Build only the requested Member 4 phase.

Use the agentic docs for future compatibility, but do not implement backend agentic GeoOps features unless explicitly requested.

Do not call Featherless or runtime Mapbox MCP from the frontend.
Do not modify backend/API/AI/voice/Supabase/validation internals.
Use existing APIs, adapters, mock data, and fallback data.
Keep Phase 1/2 behavior working.
```
