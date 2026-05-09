# Project Plan — AI Emergency Operations Platform

## Goal

Build a stable hackathon MVP where AI voice agents triage calls, the backend validates AI output, incidents update in Supabase, and operators visualize everything on a Mapbox command dashboard across Normal, Disaster, and World Cup/Event Surge modes.

The plan is organized three layers deep:

```text
Main Step
  → Substep
    → 1–3 smaller implementation tasks
```

## How Cursor/Codex/Opus Should Execute This Plan

This plan is designed for a four-person hackathon team **plus AI coding tools**. The goal is to let teammates work in parallel while Cursor/Codex can understand each task as a concrete implementation unit.

Use this file as an execution checklist. Each main step should produce working code, not just isolated snippets. When asking Cursor/Codex to implement a step, include:

```text
1. The relevant Main Step and Substeps from this file.
2. The project_details.md architecture file.
3. The current repository tree.
4. Any existing files that the change touches.
5. The instruction: preserve existing contracts and do not rewrite unrelated code.
```

### AI coding rules

- Implement one main step or one substep at a time.
- Prefer complete updated files when changing many lines.
- Do not change shared schemas casually; if a type changes, update all dependent files in the same commit.
- Do not create parallel fake types for the same concept.
- Use mock data that matches the real database/API schemas.
- Add helpers in `/lib` instead of duplicating logic inside components or route handlers.
- Keep API route handlers thin: parse input → call service/helper → return response.
- Keep business logic in `/lib`, not buried inside React components.
- If a dependency is missing, create a typed interface and mock implementation first.
- Each step should leave the app runnable with `npm run dev`.

### Parallel development rule

No teammate should be blocked waiting for another teammate’s full feature. The first shared foundation must be completed quickly, then each teammate works against stable contracts and mocks.

The preferred pattern is:

```text
Contract first → mock implementation → real integration → realtime/polish
```

Example:

- The Mapbox teammate should build against mock `Incident[]` that already matches the real `Incident` type.
- The AI teammate should build the Triage Agent against mock transcripts before ElevenLabs is connected.
- The voice teammate should send transcript payloads to `/api/call/turn` even before the full dashboard is polished.
- The fullstack/integration teammate should provide stable database helpers and endpoint shapes early.

### Integration rule

Merge small vertical slices early. Do not let everyone work on long-running branches that only connect at the end.

A good vertical slice is:

```text
mock transcript → /api/call/turn → fake AI output → Supabase Incident update → dashboard pin/drawer update
```

Once that works, replace fake AI with Featherless, then replace mock transcript with ElevenLabs/Twilio.

## Team Roles

### Team Member 1 — Fullstack / Integration Lead

- Owns repo structure, shared contracts, Supabase integration, deployment, and integration checks.

### Team Member 2 — Voice + Telephony

- Owns Twilio, ElevenLabs, call webhooks, transcript ingestion, transfer, and SMS.

### Team Member 3 — AI Agent Pipeline

- Owns Featherless client, Call Triage Agent, Surge / GeoOps Agent, prompts, schemas, and tool validation.

### Team Member 4 — Mapbox + Dashboard UX

- Owns Mapbox UI, incident visualization, event/disaster layers, responder visualization, incident drawer, and cluster drawer.


## Role Coordination With AI Coding Tools

Each teammate owns a workstream, but Cursor/Codex can generate large portions of implementation. The human teammate is responsible for reviewing, testing, and integrating the generated code.

### Member 1 — Fullstack / Integration Lead

Primary goal: keep the codebase coherent.

- Own shared contracts, database helpers, API route patterns, and deployment.
- Use AI coding tools to generate migrations, typed helpers, service wrappers, and integration tests/check scripts.
- Review every change that touches shared types, database shape, or API contracts.

### Member 2 — Voice + Telephony

Primary goal: make the live phone demo reliable.

- Own Twilio number setup, ElevenLabs agent setup, transcript ingestion, transfer, and SMS.
- Use AI coding tools to scaffold webhook handlers and Twilio/ElevenLabs wrappers.
- Work against `/api/call/start`, `/api/call/turn`, and `/api/operator/takeover` contracts.

### Member 3 — AI Agent Pipeline

Primary goal: make Featherless-powered reasoning reliable and bounded.

- Own prompts, schemas, tool registry, controlled agent runtime, and fallback behavior.
- Use AI coding tools to create typed schemas, sample test transcripts, and agent service functions.
- Never let the model directly mutate Supabase, Twilio, or Mapbox.

### Member 4 — Mapbox + Dashboard UX

Primary goal: make the product visibly impressive and operationally clear.

- Own dashboard shell, Mapbox layers, incident queue, drawers, heatmaps, clusters, event layers, and responder overlays.
- Use AI coding tools to generate components, mock GeoJSON, and visualization helpers.
- Build from real shared types so backend data can replace mocks without refactoring.
- Consume existing APIs and shared contracts; do not modify backend, API, AI, voice, Supabase, or validation internals unless explicitly assigned.

### Cross-team contract freeze

After Main Step 1, these items should only change intentionally:

- `Incident` type;
- `CallSession` type;
- `/api/call/turn` request/response;
- LLM output schema;
- Supabase table names and key fields.

If one of these changes, the teammate making the change must update all affected mock data, backend helpers, UI components, and docs.


## Definition of Done for Each Main Step

Before moving to the next main step, check:

- The app still starts locally.
- TypeScript compiles.
- Existing mock/demo path still works.
- Shared types are not duplicated.
- New API routes have sample request/response payloads.
- New AI outputs are schema-validated.
- New database mutations are logged or auditable.
- UI changes handle loading, empty, and error states.
- Run full checks when practical. If full `npm run lint` fails because of unrelated pre-existing files, run targeted checks on changed files and report both results.

This prevents the codebase from becoming a hackathon pile of disconnected prototypes.

## Main Step 1 — Lock the System Contracts

### 1.1 Define shared TypeScript types

- Create `Incident`, `CallSession`, `TranscriptEvent`, `Responder`, `EventLayer`, and `SurgeCluster` types.
- Define mode enums: `normal`, `disaster`, `world_cup`.
- Define urgency/status/control-state enums.

### 1.2 Define API request/response contracts

- Specify `/api/call/start`, `/api/call/turn`, `/api/operator/takeover`, `/api/simulate/disaster`, and `/api/simulate/world-cup` shapes.
- Add sample JSON payloads for each endpoint.
- Keep contracts in `/lib/types/api.ts` or `/docs/api-contracts.md`.

### 1.3 Define AI output schemas

- Create Zod schema for Call Triage Agent output.
- Create Zod schema for Surge / GeoOps Agent output.
- Add fallback behavior for invalid AI output.

## Main Step 2 — Set Up the Project Foundation

### 2.1 Initialize the Next.js app structure

- Create folder structure for `app/api`, `components`, `lib`, and `supabase`.
- Add `.env.example` with required keys.
- Add basic README setup instructions.

### 2.2 Add Supabase integration

- Create Supabase client wrapper.
- Add migration files for core tables.
- Test local insert/read for one fake Incident.

### 2.3 Add baseline dashboard shell

- ~~Create dashboard route.~~
- ~~Add top bar, left incident panel, center map container, and right drawer placeholder.~~
- ~~Use mock data matching the real Incident type.~~

## Main Step 3 — Build the Database Layer

### 3.1 Create database tables

- Add `incidents` table.
- Add `call_sessions` table.
- Add `transcript_events` and `audit_logs` tables.

### 3.2 Add optional support tables

- Add `responders` table or mock responder JSON file.
- Add `event_layers` table or mock event layer JSON file.
- Add seed data for disaster and World Cup modes.

### 3.3 Build database helper functions

- Create `createIncident`, `updateIncident`, and `getIncidentById`.
- Create `createCallSession`, `updateCallSession`, and `closeCallSession`.
- Create `appendTranscriptEvent` and `appendAuditLog`.

## Main Step 4 — Build the Mapbox UI Mock

Mapbox work should stay client-side and consume typed dashboard state from shared contracts or adapters. Use the side drawer as the primary operational UI; Mapbox popups may be supplemental but should not become the main workflow.

### 4.1 Render the core command map

- ~~Add Mapbox GL to dashboard.~~
- ~~Render incident pins using mock Incident data.~~
- ~~Add pin colors by urgency.~~
- ~~Stabilize initial map loading so Mapbox mounts while incidents fetch.~~

### 4.2 Add disaster visualization layers

- Add heatmap layer.
- Add cluster layer.
- Add impact zones and blocked roads using mock GeoJSON.

### 4.3 Add World Cup visualization layers

- ~~Add stadium/fan-zone polygons.~~
- ~~Add medical tents, police/security tents, lost-and-found, and tourist help points.~~
- ~~Add high-density crowd zones and restricted vehicle zones.~~

### 4.4 Add responder visualization

- Create `/api/responders/mock` or static JSON responder data.
- Show ambulances, police, fire, and event staff on the map.
- Add map layer toggle for responders.

## Main Step 5 — Build the Dashboard UX

Dashboard UX should keep the map as the visual centerpiece while using queue/drawer components for operator decisions and detailed actions.

### 5.0 Add dashboard data/action adapters

- ~~Create typed frontend adapters for incidents, operator actions, simulations, and responders so dashboard components do not scatter direct fetch calls.~~

### 5.1 Build incident queue

- ~~Display active incidents sorted by urgency/priority.~~
- ~~Add filters for mode, urgency, status, and assigned operator.~~
- ~~Highlight critical incidents.~~

### 5.2 Build incident drawer

- ~~Show incident type, urgency, status, location, summary, missing fields, collected fields, and recommended action.~~
- ~~Show transcript preview.~~
- ~~Add action buttons: Take Over, Mark Resolved, Send SMS, Add Note.~~

### 5.2a Add demo controls and simulation buttons

- ~~Add visible dashboard controls for Disaster and World Cup simulations.~~
- ~~Add Refresh Incidents and Reset View / Clear Selection controls.~~
- ~~Show active calls, critical incidents, and operator load metrics.~~
- ~~Refetch incidents after successful simulation actions.~~

### 5.2b Add responder visualization and layer controls

- ~~Fetch mock responders through the dashboard adapter.~~
- ~~Show responder markers for ambulance, fire, police, and event staff.~~
- ~~Add map layer controls for incidents, responders, and future layers.~~
- ~~Keep future heatmap, cluster, disaster, event, and route toggles disabled until their phases.~~

### 5.2c Add disaster mode map layers

- ~~Add incident-coordinate heatmap layer.~~
- ~~Add local or mock surge cluster circles.~~
- ~~Add mock disaster impact zones and blocked roads as GeoJSON layers.~~
- ~~Wire disaster layer toggles without reinitializing Mapbox.~~

### 5.3 Build cluster drawer

- ~~Show cluster title, incident count, urgency breakdown, summary, and top recommended action.~~
- ~~Link cluster incidents to the incident queue.~~
- ~~Highlight cluster on Mapbox when selected.~~

## Main Step 6 — Build Featherless Client and AI Agent Runtime

### 6.1 Create Featherless client wrapper

- Add environment variable for Featherless API key.
- Create `callFeatherless(messages, options)` helper.
- Add timeout and error handling.

### 6.2 Build controlled agent runtime

- Create a generic `runControlledAgent` helper.
- Limit the number of model/tool steps.
- Log model responses and tool requests for debugging.

### 6.3 Add safe tool registry

- Add `geocode_location` tool.
- Add `event_zone_lookup` tool.
- Add `responder_lookup` tool.
- Reject unknown or unsafe tool requests.

## Main Step 7 — Build the Call Triage Agent

### 7.1 Create prompt and schema

- Write system prompt explaining the agent’s role and limitations.
- Include Incident and CallSession context.
- Require strict JSON output.

### 7.2 Handle non-emergency calls

- Test stolen bike/lost item cases.
- Ensure AI collects missing fields.
- Ensure AI closes CallSession when report is complete.

### 7.3 Handle emergency calls

- Test active break-in/medical collapse/trapped person cases.
- Ensure AI asks location once.
- Ensure backend triggers transfer only after validation.

## Main Step 8 — Build Core Backend Call Endpoints

### 8.1 Implement `/api/call/start`

- Create Incident.
- Create CallSession.
- Return IDs to voice layer/dashboard.

### 8.2 Implement `/api/call/turn`

- Save final transcript event.
- Run Call Triage Agent.
- Validate AI output and execute safe tools.
- Update Incident and CallSession.

### 8.3 Implement `/api/call/end`

- Close CallSession.
- Mark Incident completed or abandoned.
- Write audit log.

## Main Step 9 — Build Operator Control Endpoints

### 9.1 Implement `/api/operator/takeover`

- ~~Set Incident `human_active`.~~
- ~~Close CallSession.~~
- ~~Trigger call transfer if live call exists.~~

### 9.2 Implement `/api/operator/update-incident`

- ~~Allow operator-safe edits.~~
- ~~Validate patch fields.~~
- ~~Write audit log.~~

### 9.3 Implement `/api/operator/resolve`

- ~~Mark incident resolved.~~
- ~~Close active sessions.~~
- ~~Update dashboard state.~~

## Main Step 10 — Build Voice + Telephony Demo

### 10.1 Configure Twilio demo number

- Buy/configure Twilio number.
- Route inbound calls to ElevenLabs or backend webhook depending on chosen setup.
- Test call from the demo caller phone.

### 10.2 Configure ElevenLabs agent

- Create AI voice agent.
- Connect transcript events to backend.
- Keep agent responses short and fast.

### 10.3 Add call transfer path

- Configure transfer to teammate operator phone.
- Test emergency transfer.
- Make dashboard update when transfer is requested/transferred.

### 10.4 Add SMS support

- Create SMS helper.
- Send report reference after non-emergency completion.
- Send short confirmation for emergency/event calls.

## Main Step 11 — Build Realtime Dashboard Updates

### 11.1 Subscribe to incidents

- ~~Add Supabase Realtime subscription for `incidents`.~~
- ~~Update incident queue without refresh.~~
- ~~Update selected incident drawer live.~~

### 11.2 Sync Mapbox state

- ~~Add/update/remove pins when incidents change.~~
- ~~Show pin only when coordinates exist.~~
- Animate or highlight new critical incidents.

### 11.3 Show live transcript

- ~~Subscribe to `transcript_events`.~~
- ~~Display transcript in selected incident drawer.~~
- ~~Label caller vs AI/operator turns.~~

## Main Step 12 — Build Disaster Mode Simulation

### 12.1 Create simulated transcript set

- Write 29 earthquake-related mini-transcripts.
- Include varied severity: trapped person, injury, gas smell, blocked road, outage, minor report.
- Leave some missing fields intentionally.

### 12.2 Implement `/api/simulate/disaster`

- Create 29 Incident + CallSession records.
- Process transcripts in controlled batches.
- Use same Call Triage Agent pipeline as real calls.

### 12.3 Activate surge state

- Detect call volume threshold.
- Switch dashboard to Disaster Mode.
- Show heatmap, clusters, impact zones, responder markers, and priority queue.

## Main Step 13 — Build World Cup / Event Surge Mode

### 13.1 Create mock event geography

- Add stadium/fan-zone polygons.
- Add medical tents, police/security tents, lost-and-found, tourist help points, transit nodes, and restricted vehicle zones.
- Store as GeoJSON or `event_layers` rows.

### 13.2 Create simulated World Cup transcripts

- Include multilingual examples.
- Include lost person, medical incident, crowd congestion, theft, transit disruption, and security concern.
- Keep tourist-assistance classification simple and severity-focused.

### 13.3 Implement `/api/simulate/world-cup`

- Create simulated call sessions.
- Process through same backend + AI agent pipeline.
- Show event-specific layers on Mapbox.

## Main Step 14 — Build Surge / GeoOps Agent

### 14.1 Create surge input builder

- Load active incidents.
- Load responder mock data.
- Load event/disaster layer data.

### 14.2 Generate cluster and priority output

- Ask agent to summarize clusters and rank incidents.
- Validate output schema.
- Save cluster IDs and priority scores to incidents.

### 14.3 Update dashboard with surge intelligence

- Show top priority queue.
- Show cluster summaries.
- Highlight hotspots on Mapbox.

Note: do not build full AI routing optimization in the first version. Mock route lines are acceptable.

## Main Step 15 — Integration Hardening

### 15.1 Add fallback behavior

- If Featherless fails, ask a safe fallback question or escalate.
- If geocoding fails, leave incident in side panel without map pin.
- If transfer fails, show operator alert.

### 15.2 Add validation and audit logs

- Validate all AI patches.
- Log every status change.
- Log every operator action.

### 15.3 Add loading/error states

- Show call processing state.
- Show AI reasoning state.
- Show transfer status and failed transfer status.

## Main Step 16 — Demo Polish

### 16.1 Prepare demo scripts

- Normal call: stolen bike/lost item.
- Emergency call: break-in or medical collapse.
- Disaster surge: earthquake simulation.
- World Cup surge: stadium/fan-zone simulation.

### 16.2 Prepare dashboard states

- Start with clean dashboard.
- Trigger simulation with one button.
- Keep reset button for demo recovery.

### 16.3 Prepare pitch assets

- Add architecture diagram.
- Add screenshots/GIFs.
- Add concise README.

## Main Step 17 — Deployment

### 17.1 Deploy frontend/backend

- Deploy Next.js to Vercel or equivalent.
- Add environment variables.
- Test API routes in deployed environment.

### 17.2 Deploy database

- Use hosted Supabase.
- Apply migrations.
- Seed mock data.

### 17.3 Test full external flow

- Call Twilio number from real phone.
- Confirm ElevenLabs responds.
- Confirm backend receives transcript.
- Confirm dashboard updates.
- Confirm transfer reaches teammate phone.

## Recommended Parallel Work Schedule

### Phase A — First foundation block

- Member 1: shared types + Supabase schema.
- Member 2: Twilio/ElevenLabs setup.
- Member 3: Featherless client + AI output schemas.
- Member 4: dashboard shell + Mapbox mock.

### Phase B — Integration block

- Member 1: call/session API endpoints.
- Member 2: transcript webhook + transfer.
- Member 3: Call Triage Agent.
- Member 4: incident drawer + realtime map updates.

### Phase C — Surge features

- Member 1: simulation endpoints.
- Member 2: SMS + call status visualization.
- Member 3: Surge / GeoOps Agent.
- Member 4: disaster/world cup layers.

### Phase D — Demo polish

- Member 1: deployment + bugfixes.
- Member 2: live call demo reliability.
- Member 3: prompt tuning + fallbacks.
- ~~Member 4: UI polish + map presentation.~~
