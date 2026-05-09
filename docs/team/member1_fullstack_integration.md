# Member 1 — Fullstack / integration status

**Sources:** [`project_plan.md`](../project_plan.md) (Member 1, Main Steps 1–2, contract freeze, Definition of Done), [`project_details.md`](../project_details.md) (§5 workflow, §12 schema, §11 backend layout, AI boundaries), [`api_contracts.md`](../api_contracts.md) (HTTP + domain contracts). Legacy: `project_full_context_and_future_features.md` §1–§10 (core pipeline; §11+ out of scope for early build).

**Contract source of truth for HTTP shapes:** [`docs/api_contracts.md`](../api_contracts.md) — aligned with `lib/types/api.ts` and route handlers.

This note tracks **`lib/`**, **`app/api/*`**, **`app/dev/*`**, persistence (Supabase vs in-memory), the **voice-path E2E harness**, and automated tests from the integration pass.

---

## Role checklist (`project_details` §19 / `project_plan` §73–§100)

| Responsibility       | Status         | Where / notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository structure | **Advanced**   | `lib/types`, `lib/server`, `lib/supabase`, `lib/ai`, `lib/validation`, **`lib/db/*`**, **`lib/tools/*`**, **`lib/surge/*`** (GeoOps input builder for **`/api/surge/analyze`**). `lib/voice/*` exists for webhooks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Shared types         | **Done**       | `lib/types/` — domain in `domain.ts`; **`lib/types/api.ts`** aligned with **`docs/api_contracts.md`** (call start/turn/end, operator, simulate, responders).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Dashboard shell      | **Partial**    | **`/dashboard`** (`app/dashboard/page.tsx` + `DashboardShell`): incident list from **`GET /api/dev/incidents`**, **Realtime** on `public.incidents`, **drawer tabs** (triage / operator / details / transcript) + **`LiveTranscriptPanel`** (`lib/data/supabaseTranscriptDataSource.ts` — fetch + **`transcript_events`** subscription when anon env allows), **persona** visibility (`lib/dashboard/dashboardPersona.ts`, **`DashboardPersonaContext`**), cluster **fly-to** on selection (**`CommandMap`**), incident → cluster via **`findSurgeClusterForIncident`**, **`DemoControls`** (disaster default batch **50**, route **`maxCap: 100`**). **Still open vs plan:** **`call_sessions`** Realtime, regional strategy / full surge–map sync, DoD polish (Member 4). |
| Supabase client      | **Done**       | `lib/supabase/{env,server,client,middleware}.ts` + **`lib/supabase/service.ts`** (service-role server client, no session). Root `middleware.ts` where present.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Migrations / schema  | **Done (SQL)** | `supabase/migrations/*`; RLS on tables. **`20260507194500_anon_select_incidents_sessions_transcripts.sql`** adds **anon SELECT** on `incidents`, `call_sessions`, `transcript_events` for browser Realtime + read models (tighten before production).                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| API persistence      | **Dual path**  | **`lib/db/call-repository.ts`**: uses **`getServiceRoleClient()`** when `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise **`lib/server/demo-store.ts`** (RAM).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Integration checks   | **Partial**    | **`npm run test` / `npm run test:run`** (Vitest on `lib/**/*.test.ts`). **Browser:** [`/dev/voice-sim`](../../app/dev/voice-sim/page.tsx) exercises `call/start` → `call/turn` → `call/end` without Postman. No Playwright/Cypress in repo yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Deployment / CI      | **Not done**   | No GitHub Actions; `.env.example` documents env vars (including optional **`NEXT_PUBLIC_MAPBOX_TOKEN`** for the dashboard map).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

---

## Main Step 1 — contracts (`project_plan` §154–§172)

| Substep             | Doc expectation                                                                      | Repo                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 Shared TS types | `Incident`, `CallSession`, `TranscriptEvent`, `Responder`, `EventLayer`, modes/enums | **Met** in `lib/types/domain.ts`, `enums.ts`, `geo.ts`, `json.ts`.                                                                                                                                                                                                                                                                                                                                         |
| 1.2 API contracts   | HTTP request/response shapes                                                         | **Met** in **`docs/api_contracts.md`** and **`lib/types/api.ts`** — e.g. `CallStartResponse` includes full `incident` + `call_session`; `CallTurnResponse` includes `transcript_event` and `actions: SystemAction[]`; `CallEndRequest` supports `reason` and legacy `outcome`; operator update/resolve/send-sms; simulate disaster/world-cup responses with `created_incidents` / `created_call_sessions`. |
| 1.3 AI Zod schema   | Triage output validated                                                              | **Met** in `lib/ai/schemas/triageAgentOutputSchema.ts`; exports used by API types include **`SystemAction`**, tool request types where wired.                                                                                                                                                                                                                                                              |

**Contract freeze:** Changing `Incident` / `CallSession` / triage Zod / public API shapes still requires coordinated updates (mock agent, `merge-triage-output`, `call-repository`, routes, future UI).

---

## Main Step 2 — foundation (`project_plan` §174–§192)

| Substep                  | Doc expectation                                                     | Status                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 App folders          | `app/api`, `components`, `lib`, `supabase`                          | **`app/api`** (call, operator, simulate, responders, **dev**), **`app/dev`** (voice sim), **`components/`** (includes **`components/dev/`**), **`lib/`**, **`supabase/migrations`**; README varies.                                                                                                                                                           |
| 2.2 Supabase integration | Client + migrations + read/write proof                              | **Service path:** inserts/updates/selects via **`lib/db/call-repository.ts`** when service role env is configured. **Fallback:** in-memory **`demo-store`** for local/demo without Supabase. **`app/page.tsx`** uses **server** Supabase client (anon) — separate from API persistence.                                                                       |
| 2.3 Dashboard shell      | Dashboard route, regions, mock incidents (`project_plan` §188–§192) | **Partial:** queue + Mapbox/offline map + **tabbed drawer** + operator API actions + **live transcript panel** + persona modes + **cluster navigation** from drawer/map. **Remaining:** regions / mock-incident strategy per doc, **`call_sessions`** Realtime, full Mapbox + surge UX polish. **Minimal call-path UI** remains **`/dev/voice-sim`**. |

---

## Done vs Not Done (by docs)

This section summarizes what is **implemented now** vs **still missing**, mapped to:

- `docs/project_plan.md` main steps
- `docs/api_contracts.md` endpoint list
- `docs/project_details.md` recommended architecture items

### Done (core vertical slice)

- **Main Step 1 — Contracts**
  - **1.1 Shared TS types**: `lib/types/{domain,enums,geo,json,tools}.ts`
  - **1.2 API contracts**: `docs/api_contracts.md` + `lib/types/api.ts`
  - **1.3 AI output schemas**: `lib/ai/schemas/triageAgentOutputSchema.ts`
- **Main Step 2 — Foundation (partial)**
  - **2.1 App structure**: enough for API + dev harness (`app/api/*`, `app/dev/*`, `components/dev/*`, `lib/*`, `supabase/migrations/*`)
  - **2.2 Supabase integration**: service-role persistence + in-memory fallback (`lib/supabase/service.ts`, `lib/db/call-repository.ts`, `lib/server/demo-store.ts`)
- **Main Step 8 — Core backend call endpoints**
  - `POST /api/call/start`, `POST /api/call/turn`, `POST /api/call/end` (all implemented under `app/api/call/*`)
  - **Final turns call triage** via `runCallTriageAgent` inside `repositoryCallTurn` and persist merged patches (Supabase if service role configured).
- **Main Step 9 — Operator control endpoints**
  - `POST /api/operator/takeover`, `update-incident`, `resolve`, `send-sms`
  - Note: `send-sms` is currently a **stub** (returns `sent: false`; audit log written).
- **Main Step 12/13 — Simulation endpoints**
  - `POST /api/simulate/disaster`, `POST /api/simulate/world-cup`
  - **`reset_existing`** optional body flag (Zod + routes + repository): clears incidents (Supabase delete-all-in-table path or in-memory **`resetDemoStore`**) before seeding; **`batch_size: 0`** supported for “wipe only”.
  - **`lib/server/simulate-seed-enrichment.ts`** + **`lib/mock/simulate-seed-geometry.ts`**: deterministic **Toronto-area pins** (disaster uses **per-scenario slot offsets** shared with **`EVENT_ZONES`** / map impact layers); seeds append **caller + AI** lines to **`call_session.recent_transcript`**; **disaster** batches assign the first simulated rows to **`DIS-SIM-OP-*`** so **`assigned_operator`** / **`human_active`** reflect operator load in the UI (**`mergeSimulatedSurgeRow`** batch options).
- **Supporting endpoints / dev harness**
  - `GET /api/responders/mock`
  - Dev harness: `/dev/voice-sim` + `GET /api/dev/persistence`
  - Operator dev simulator: `GET /api/dev/incidents` + UI that drives `/api/operator/*`
  - **`GET /api/dev/call-sessions?incident_id=`** — lists `call_sessions` for one incident (dashboard drawer + debugging)
  - Dev-only triage dry-run: `POST /api/dev/triage-preview` (runs `runCallTriageAgent` with no DB writes)
- **Main Step 11 — Realtime (partial)**
  - **`/dashboard`** subscribes to **`public.incidents`** via Supabase Realtime and **refetches** `GET /api/dev/incidents` on change.
  - **`transcript_events`**: drawer **`LiveTranscriptPanel`** loads history + **`subscribeTranscriptEventsForIncident`** when **`lib/data/supabaseTranscriptDataSource`** reports the browser client is available (same anon **SELECT** + migration as incidents). **`repositoryCallTurn`** (final triage) appends the agent **`say_to_caller`** line as **`speaker: "ai"`** to **`transcript_events`** (Supabase + in-memory **`appendTranscriptEvent`**). Simulate seed enrichment calls **`persistSimulateSeedTranscriptEvents`** so seeded **`recent_transcript`** snippets become **`transcript_events`** rows for the dashboard.
  - Still missing: Realtime on **`call_sessions`**; broader loading/error DoD; optional further transcript UX (audio **`incidents.audio_url`** deferred per **`project_details`** MVP notes — UI block commented in **`LiveTranscriptPanel`**).
- **Main Step 14 — Surge / GeoOps (baseline, Member 1)**
  - **`POST /api/surge/analyze`**, **`lib/surge/buildSurgeGeoOpsAgentInput.ts`**, **`repositorySurgeAnalyze`**: validated **`runSurgeGeoOpsAgent`** output, persists **`cluster_id`** + rank-derived **`priority_score`**, audit log. **`GEOOPS_PROVIDER`** (fallback **`AI_PROVIDER`**) is passed into the agent for the next integration step.

### Not done yet (gaps vs docs)

- **Main Step 2.3 / Steps 4–5 (remainder)**: **regions** / mock-incident strategy, surge-driven map behaviour end-to-end, full DoD polish (baseline `/dashboard` + cluster UX + transcript panel **now in repo**)
- **Main Step 10 (remainder)**: production hardening (e.g. Twilio signature verification), real SMS sending beyond operator stub — webhooks + **`lib/voice/*`** are in repo
- **Main Step 11 (remainder)**: Realtime for **`call_sessions`** only; Mapbox / cluster UX polish; loading/error DoD
- **Main Step 14 (remainder)**: model + **tool loop** inside **`runSurgeGeoOpsAgent`**; dashboard / demo **calls** to **`/api/surge/analyze`** (**`project_plan`** §14.3 “surge intelligence” wiring)
- **Main Step 15–17**: hardening, demo polish, deployment/CI
- **`project_details` §11 diagram vs repo** — webhook routes and **`lib/voice/*`** exist (filenames may differ); DB helpers are mostly consolidated in **`lib/db/call-repository.ts`** rather than separate `incidents.ts` / `callSessions.ts`. Operator SMS remains a **stub**.

---

## Integration change log (what we added so far)

This consolidates the “integration notes” into this Member 1 status doc so there is a single place to answer:

- what was added/changed in code,
- which contracts/milestones it covers,
- and what is still missing relative to `api_contracts` / `project_details` / `project_plan`.

### AI triage provider routing (Member 3 handoff integrated)

- **`runCallTriageAgent` entrypoint**: `lib/ai/agents/callTriageAgent.ts`
  - `AI_PROVIDER=mock` → deterministic `mockCallTriageAgent`
  - `AI_PROVIDER=gemma` → calls Gemma, validates JSON, **falls back to mock** on errors/invalid output
  - `AI_PROVIDER=featherless` → reserved; currently **falls back to mock**
- **Gemma client**: `lib/ai/providers/gemmaClient.ts` (Generative Language API; requests JSON)
- **Backend wiring**: `lib/db/call-repository.ts` calls `runCallTriageAgent` on **final** transcript turns and persists merged patches (Supabase service role or in-memory fallback).
- **Tests**: `lib/ai/agents/callTriageAgent.test.ts`
- **Env**: `.env.example` documents `AI_PROVIDER`, `GEMMA_API_KEY`, `GEMMA_MODEL`, `FEATHERLESS_*`

### Safe tool runtime (now integrated)

- **Tool registry**: `lib/ai/toolRegistry.ts`
  - Allowed tools are constrained to what’s specified in **`docs/project_details.md`** and **`docs/api_contracts.md`**:
    - `geocode_location`
    - `event_zone_lookup`
    - `responder_lookup`
    - `sms_draft`
- **Tool dispatcher**: `lib/ai/executeAllowedToolRequests.ts`
  - Validates tool name + args (Zod), enforces per-tool timeouts, blocks disallowed modes, and returns normalized `ToolResult[]`.
  - Never throws on per-tool failures; failures become `ToolResult { ok: false, error }`.
- **Executor implementations** (`lib/tools/*`, mock-first):
  - `lib/tools/geocodeLocation.ts`
  - `lib/tools/eventZoneLookup.ts`
  - `lib/tools/responderLookup.ts`
  - `lib/tools/smsDraft.ts` (draft only; does not send)
- **Two-pass loop wired into `repositoryCallTurn`**: `lib/db/call-repository.ts`
  - Pass 1: agent output → `tool_requests`
  - Backend executes allowed tools → `tool_results`
  - Pass 2: agent receives `toolResults` and produces the final patch
  - Trace is returned in `CallTurnResponse.triage_trace` and written to `audit_logs` as `call_turn_final`

### Dev-only triage preview (no persistence)

- `POST /api/dev/triage-preview`: `app/api/dev/triage-preview/route.ts`
  - runs the same triage stack (`runCallTriageAgent`) but **does not write** transcript or patch rows.
- Server helper: `lib/simulate/voice-sim-triage-server.ts`
- Validation: `triagePreviewRequestSchema` in `lib/validation/api-requests.ts` (+ tests)
- Dev UI: `components/dev/ElevenLabsVoiceSimulator.tsx` exposes a “Triage preview” button and renders the last preview JSON.
- Typed preview body helper: `lib/simulate/elevenlabs-voice-sim.ts`

### Operator simulation (reads incidents and drives `/api/operator/*`)

- `GET /api/dev/incidents`: `app/api/dev/incidents/route.ts` (Supabase service role if configured; otherwise in-memory store)
- `GET /api/dev/call-sessions`: `app/api/dev/call-sessions/route.ts` → `repositoryListCallSessionsForDev`
- Repository listing: `repositoryListIncidentsForDev` in `lib/db/call-repository.ts`
- In-memory listing: `listAllIncidentsSorted()` in `lib/server/demo-store.ts`
- Operator sim request builders: `lib/simulate/operator-flow-sim.ts`
- Operator sim UI: `components/dev/OperatorFlowSimulator.tsx`
- Dev page: `app/dev/voice-sim/page.tsx` hosts both the voice simulator and operator simulator

### Dashboard data wiring (Member 4 UI ↔ Member 1 APIs)

- **`lib/data/apiIncidentDataSource.ts`**: browser feed for **`GET /api/dev/incidents`** with fallback mock incidents + messages (`IncidentDataSource` pattern).
- **`lib/data/dashboardIncidentFeed.ts`**: `fetchDashboardIncidents`, `fetchCallSessionsForIncident`, **`subscribeIncidentsRealtime`** + **`isDashboardRealtimeAvailable`** (used by shell for debounced refetch on `public.incidents` changes).
- **`lib/data/dashboardCommandApi.ts`**: typed **`postJson`** wrappers for **`POST /api/operator/*`** (takeover, update-incident, resolve, send-sms).
- **`lib/http/postJson.ts`**: shared `{ ok, status, data, errorText }` helper for dashboard + simulate clients.
- **`lib/data/simulationClient.ts`**: existing **`simulationClient`** object plus **`postSimulateDisaster`** / **`postSimulateWorldCup`** for **`DemoControls`** error banners.
- **`components/dashboard/DashboardShell.tsx`**: composes feed, Realtime (debounced **`loadIncidents`**), **`DemoControls`**, queue, **`CommandMap`**, **`IncidentDrawer`** (selection ref for post-command session refetch).
- **`components/dashboard/TopBar.tsx`**: shows **`Realtime`** pill when **`subscribeIncidentsRealtime`** is active (anon env + migration).
- **`components/dashboard/DemoControls.tsx`**: dashboard-only buttons for disaster / world-cup simulate + clear-all (reset + empty batch).
- **`components/map/CommandMapOffline.tsx`**: selectable incident list when Mapbox token absent.
- **`components/incidents/IncidentDrawerActions.tsx`**: operator buttons wired to **`dashboardCommandApi`** + **`lib/simulate/operator-flow-sim.ts`** request builders.
- **`components/incidents/IncidentDrawer.tsx`**: tabbed **triage / operator / details / transcript** (ARIA tablist); **`activeCallSession`** + operator actions on **Operator** tab; **`LiveTranscriptPanel`** on **Transcript** tab; **cluster** jump from **Details** when a map cluster contains the incident; visibility flags from **`useDashboardPersona`** (hide internal IDs, infra badges, demo strip for executive-style personas).
- **`components/map/CommandMap.tsx`**: when a **cluster** is selected, **flyTo** its center (validates coordinates via **`isValidCoordinates`**); turns on cluster layer overlay as needed.
- **`lib/map/clustering.ts`**: **`findSurgeClusterForIncident`** links **`SurgeCluster`** geometry to the selected **`Incident`**.

### Dashboard persona + live transcript UX (`project_plan` Main Step 2.3, Step 11 overlap)

- **`lib/dashboard/dashboardPersona.ts`**: persisted **`DashboardPersonaId`** (localStorage) + per-persona **`visibility`** flags (verbose feed banner, demo controls, operator load breakdown, transcript “infrastructure” / developer-only blocks, etc.).
- **`components/dashboard/DashboardPersonaContext.tsx`** + **`DashboardShell`**: wraps the dashboard tree; **`TopBar`** exposes a **Persona** `<select>`; **`DemoControls`** / infra pills / **`OperatorLoadPanel`** breakdown respect visibility.
- **`components/voice/LiveTranscriptPanel.tsx`**: initial fetch + **Realtime** on **`transcript_events`** when available; **Export .txt** of loaded lines; optional **`transcript_url`** link gated to developer persona; **`audio_url`** block left commented pending **`project_details`** recording strategy.
- **`components/voice/CallControlPanel.tsx`**: takeover success copy matches **`repositoryOperatorTakeover`** semantics (human active, session closed).

### Simulate seeds ↔ `transcript_events` + disaster geometry (`api_contracts` transcript shape, `project_details` section 9.2)

- **`mergeSimulatedSurgeRow`** (`simulate-seed-enrichment.ts`): builds **`recent_transcript`** snippets (caller scenario text + AI **`next_question`**); disaster **batch-local index** drives **`DIS-SIM-OP-*`** assignment for the first N rows in a batch.
- **`persistSimulateSeedTranscriptEvents`** in **`call-repository.ts`**: inserts new **`transcript_events`** for Supabase; in-memory path uses **`appendSeedTranscriptEvents`** in **`demo-store.ts`** so **`LiveTranscriptPanel`** sees the same data without voice.
- **`lib/mock/simulate-seed-geometry.ts`**: shared Toronto anchor, jitter, and **disaster impact zone bboxes** aligned with simulate pins and **`disasterSimImpactEventZoneSeeds`** in **`lib/tools/_mockGeo.ts`** (spread into **`EVENT_ZONES`**).
- **`lib/mock/disasterLayers.ts`**: static Mapbox **`EventLayer`** lists derive from **`EVENT_ZONES`** (impact polygons + blocked roads) instead of hard-coded coordinates.
- **`POST /api/simulate/disaster`**: route **`maxCap`** raised to **100**; **`DemoControls`** default disaster **`batch_size`** is **50**.

### Disaster + World Cup seed expansion + `event_layers` SQL seed (`project_plan` §12.1, §13.1–§13.3)

- **`lib/mock/simulate-seed-geometry.ts`**: **`DISASTER_SIM_SEED_GEO_SLOTS`** grew from **4 → 29** entries (slots 0–3 unchanged so `repositorySimulateDisaster` test invariants — slot 0 → `structure_fire`, summary contains "smoke", `next_question` contains "floor" — still hold). Mix: **6 critical, 12 urgent, 10 non_emergency, 1 unknown** Toronto-area offsets. **`disasterSimImpactZoneBboxes`** automatically picks up the new slots so the impact-zone envelopes widen to the full cohort.
- **`lib/server/simulate-seed-enrichment.ts`** — **`DISASTER_SCENARIOS`**: 4 → **29** earthquake-related mini-transcripts (project_plan §12.1) covering trapped persons, gas leaks, structural collapse, elevator entrapment, broken water main, fallen tree, abandoned vehicle, transit delay, aftershock check‑in, plus an "unclear caller" cut-off case for the `unknown` urgency band.
- **`lib/server/simulate-seed-enrichment.ts`** — **`WORLD_CUP_SCENARIOS`**: 4 → **13** with **multilingual** seed_caller_text plus `caller_language` / `original_text` in `collected_fields` for **`es`**, **`pt`**, **`fr`**. Adds lost child, heat exhaustion, crowd push at gate, theft, transit disruption, security perimeter breach, tourist help, lost-and-found pickup, counterfeit ticket dispute.
- **`lib/server/responders-mock-data.ts`**: 3 → **12** mock responders, including the previously missing **`event_staff`** units (`EVS-1..4`) anchored at BMO Field, fan zones, and the transit hub; extra EMS / police / fire units for richer surge analyze + responder_lookup output.
- **`supabase/migrations/20260509200000_seed_event_layers.sql`** _(new)_ — idempotently seeds `public.event_layers` with the **16 World Cup layers** from **`lib/mock/worldCupLayers.ts`** (stadium perimeter, fan zones, restricted vehicle zone, crowd density polygons, medical / police / security / lost & found / tourist help / transit nodes, road closures) plus **5 disaster layers** (critical + urgent impact-zone polygons sized to the new 29-seed jitter envelope, two blocked roads — Bay St + Lakeshore @ Strachan — and the Exhibition responder staging area). Adds an **anon SELECT** policy on `event_layers` (PG 15-safe via `pg_policies` guard) so dashboard overlays and `event_zone_lookup` can read seeded rows.
- **`lib/db/mappers.ts`**: new **`mapEventLayerRow`** (jsonb → `EventLayer`).
- **`lib/db/call-repository.ts`** — **`repositorySimulateWorldCup`** now reads seeded layers from Supabase via the existing **`listEventLayerRecordsForMode("world_cup")`** helper and returns them in the response (was a hard-coded `[]`). With no Supabase env, it still falls back to `[]`, so the in-memory `repositorySimulateWorldCup` vitest case continues to pass unchanged.

### Dev tooling / dependencies — vitest + zod pinned (`project_plan` §139–§151)

- **`package.json`**: pinned **`zod ^4.4.3`** as a direct **`dependency`** (was used by validation code but missing from the manifest, so clean installs would fail) and **`vitest ^2.1.9`** as a **`devDependency`** for the existing `lib/**/*.test.ts` suites; added **`test`**, **`test:run`**, and **`typecheck`** scripts.
- **`vitest.config.ts`** _(new)_: `environment: "node"`, `include: ["lib/**/*.test.ts"]`, `@/*` path alias matching `tsconfig.json`.

### Dev voice-sim hydration (`/dev/voice-sim`)

- **`components/dev/VoiceSimSimulators.tsx`**: parent **`clientMounted`** gate so child simulators avoid SSR/client **`disabled`** mismatches without per-component **`mounted`** state.
- **`ElevenLabsVoiceSimulator`** / **`OperatorFlowSimulator`**: dropped local **`mounted`**; operator sim defers first refresh with **`setTimeout(..., 0)`** after persistence probe.

### Dependencies

- **`mapbox-gl`** added as a **direct** `package.json` dependency (Mapbox GL runtime for **`CommandMap`**).

### Debugging support

- `.vscode/launch.json` provides:
  - `Next.js: dev (debug)` (Node inspector on `9229`)
  - `Next.js: attach (9229)`

## `lib/db/*` — persistence layer (new / expanded)

| File                                              | Role                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`call-repository.ts`**                          | Orchestrates call / operator / simulate / dev-listing paths as before; adds **final-triage** **`say_to_caller`** → **`transcript_events`** (and in-memory **`appendTranscriptEvent`**); **`persistSimulateSeedTranscriptEvents`** after **`mergeSimulatedSurgeRow`** so simulate **`recent_transcript`** matches the **`transcript_events`** feed. |
| **`mappers.ts`**                                  | `mapIncidentRow`, `mapCallSessionRow`, `mapTranscriptRow` — PostgREST/jsonb → `lib/types/domain`.                                                                                                                                                                                                                                                                                                                |
| **`incident-row.ts`** / **`call-session-row.ts`** | `incidentToDb` / `callSessionToDb` and insert row builders for migrations column names.                                                                                                                                                                                                                                                                                                                          |

Routes **`app/api/**/route.ts`** import the repository (not `demo-store` directly) and map thrown errors via **`repositoryErrorResponse`** in **`lib/server/api-route-helpers.ts`** (`NOT_FOUND`, `SESSION_MISMATCH`, `SESSION_INACTIVE`, `SESSION_MISSING`).

**Removed:** `lib/server/run-simulate-batch.ts` — simulate routes call **`repositorySimulateDisaster` / `repositorySimulateWorldCup`** directly.

---

## `app/api/*` route inventory

| Method | Path                            | Handler notes                                                                                                                   |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/call/start`               | `repositoryCallStart` → 201 + full incident/session                                                                             |
| POST   | `/api/call/turn`                | `repositoryCallTurn`                                                                                                            |
| POST   | `/api/call/end`                 | `repositoryCallEnd` (`reason` and/or `outcome`)                                                                                 |
| POST   | `/api/operator/takeover`        | `repositoryOperatorTakeover`                                                                                                    |
| POST   | `/api/operator/update-incident` | `repositoryOperatorUpdateIncident`                                                                                              |
| POST   | `/api/operator/resolve`         | `repositoryOperatorResolve`                                                                                                     |
| POST   | `/api/operator/send-sms`        | `repositoryOperatorSendSms` (returns `sent: false` stub)                                                                        |
| POST   | `/api/simulate/disaster`        | `repositorySimulateDisaster` (`maxCap: 100` in route; passes **`reset_existing`**)                                                |
| POST   | `/api/simulate/world-cup`       | `repositorySimulateWorldCup` (`maxCap: 50` in route; passes **`reset_existing`**)                                               |
| POST   | `/api/surge/analyze`            | `repositorySurgeAnalyze` — GeoOps clusters + **`cluster_id`** / **`priority_score`** on cohort (`api_contracts` §4.11)          |
| GET    | `/api/responders/mock`          | Responders mock data for map (`api_contracts` §4.8)                                                                             |
| GET    | `/api/dev/persistence`          | `{ uses_supabase: boolean }` — safe for browser; indicates whether `call-repository` uses service-role Supabase vs `demo-store` |
| GET    | `/api/dev/incidents`            | `repositoryListIncidentsForDev` — dashboard + operator sim                                                                      |
| GET    | `/api/dev/call-sessions`        | `repositoryListCallSessionsForDev` — query `incident_id`                                                                        |
| POST   | `/api/dev/triage-preview`       | Dry-run `runCallTriageAgent` (no DB writes)                                                                                     |

---

## Voice-path E2E harness (integration work)

Purpose (**`project_details.md`** intake narrative): exercise **Twilio/ElevenLabs-shaped** traffic against the **real** `POST /api/call/*` handlers so teammates can see **`incidents`**, **`call_sessions`**, **`transcript_events`**, **`audit_logs`** in Supabase without voice infra.

| Piece                                             | Role                                                                                                                                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`lib/simulate/elevenlabs-voice-sim.ts`**        | Builds **`CallStartRequest`** / **`CallTurnRequest`** bodies (`source: "simulate"`, sample utterances) aligned with **`api_contracts`** §4.1–4.2.                                                                                    |
| **`components/dev/ElevenLabsVoiceSimulator.tsx`** | Client UI: start call, **partial** vs **final** turn (`is_final`), end call, triage preview. Hydration guard lives in parent **`VoiceSimSimulators`**.                                                                                |
| **`components/dev/VoiceSimSimulators.tsx`**       | Wraps voice + operator simulators with a single **`clientMounted`** gate.                                                                                                                                                             |
| **`app/dev/voice-sim/page.tsx`**                  | Dev route **`/dev/voice-sim`** — renders **`VoiceSimSimulators`**.                                                                                                                                                                    |
| **`GET /api/dev/persistence`**                    | Explains whether **`SUPABASE_SERVICE_ROLE_KEY`** is set (**`api_contracts` / `project_plan`**: backend owns writes; service role for server-side inserts — **publishable/anon keys alone are not enough** for this repository path). |

**Env reminder (`project_plan` §176–§180, `.env.example`):** `NEXT_PUBLIC_SUPABASE_URL` + **`SUPABASE_SERVICE_ROLE_KEY`** → Supabase persistence from API routes. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or anon) → browser/middleware client only. Optional **`NEXT_PUBLIC_MAPBOX_TOKEN`** → Mapbox **`CommandMap`**; if unset, **`CommandMapOffline`** still drives selection from the middle column.

---

## Integration tips for other parts

Use **`docs/api_contracts.md`** as the shape contract; **`docs/project_details.md`** for pipeline semantics; **`docs/project_plan.md`** for phased ownership and Definition of Done.

### Voice / telephony (Member 2 — `project_details` §5, §11)

- Send **committed utterances** as **`POST /api/call/turn`** with **`is_final: true`** to run triage; **`is_final: false`** for interim STT if you want transcript rows without triage (**`project_details`** partial vs final). On **final** triage turns the backend also persists the agent **`say_to_caller`** as an **`ai`** **`transcript_events`** row for dashboard / audit alignment.
- Populate **`twilio_call_sid`** / **`elevenlabs_conversation_id`** on **`POST /api/call/start`** when available so sessions trace back to providers (**`api_contracts`** §4.1).
- Use **`CallTurnResponse.say_to_caller`** (and updated `incident` / `call_session`) to drive the next voice prompt — do not bypass the backend to mutate incidents (**`api_contracts`** contract rules; **`project_details`** “backend validates and executes”).

### Dashboard / Mapbox (Member 4 — `project_plan` §182–§192, §251+, `project_details` §4 stack table)

- Map and queue UI must use the **same** `Incident`, `CallSession`, `TranscriptEvent` field names and enums as **`api_contracts`** — no duplicate “demo-only” types (**`api_contracts`** §Contract Rules).
- **`/dashboard`** today: list from **`GET /api/dev/incidents`**; **Realtime** on **`public.incidents`**; **Mapbox** markers for incidents with **`coordinates`** (simulate seeds + **`mergeSimulatedSurgeRow`** / **`simulate-seed-geometry`**); **cluster** selection **flies** the map; **drawer** transcript tab uses **`transcript_events`** when Supabase browser client is configured. Without **`NEXT_PUBLIC_MAPBOX_TOKEN`**, **`CommandMapOffline`** still shares **`selectedIncidentId`** with the queue.
- After **`/api/operator/*`** or **`/api/call/*`**, the drawer uses **`onAfterCommand`** → full list refetch + **`GET /api/dev/call-sessions`** for the selected incident; Realtime covers concurrent incident row changes; transcript panel picks up new **`transcript_events`** via its own subscription.
- Buttons that change control (e.g. takeover) should call **API routes**, not patch critical state only in memory (**`api_contracts`** §Contract Rules) — **`IncidentDrawerActions`** follows this.

### AI (Member 3 — `project_plan` §1.3, §307–§316, `project_details` §6)

- **`lib/db/call-repository`** final-turn path calls **`runCallTriageAgent`** (`AI_PROVIDER`; see **`docs/team/member3_ai_agent_pipeline.md`**). Gemma responses must pass **`validateTriageAgentOutput`** before **`merge-triage-output`**; failures fall back to **`mockCallTriageAgent`**.
- **`tool_requests`** / **`system_actions`** are **proposals** — backend validates and executes allowed tools (**`project_details`** §3 key rule). The safe tool loop is implemented (registry + dispatcher + mock executors), but real voice/SMS side effects remain out of scope until Member 2 wiring exists.

### Surge / GeoOps (`project_details` §6.2, `api_contracts` §4.11, `project_plan` Main Step 14)

- **`POST /api/surge/analyze`** — **Implemented:** `app/api/surge/analyze/route.ts` → **`repositorySurgeAnalyze`** in **`lib/db/call-repository.ts`**. Loads cohort + optional responders / `event_layers`, builds input via **`lib/surge/buildSurgeGeoOpsAgentInput.ts`** (includes **`GEOOPS_PROVIDER` ?? `AI_PROVIDER`** → **`runSurgeGeoOpsAgent`**, validates output, persists **`cluster_id`** + **`priority_score`** (rank-derived) + audit **`surge_analyze`**.
- **Member 3 integration:** deterministic **`runSurgeGeoOpsAgent`** still ignores model passes; extend that function and/or pass **`recentToolResults`** from the builder when the GeoOps tool loop is added. Dashboard trigger for analyze remains Member 4 / product (`project_plan` §14.3).
- Bulk seeding continues to use **`POST /api/simulate/disaster`** and **`POST /api/simulate/world-cup`** before or after analyze.

### QA / CI (`project_plan` §139–§151)

- Before merging contract-affecting changes: app starts, **`npx tsc --noEmit`**, **`npm run test:run`**, mock/demo path still works, update **`docs/api_contracts.md`** + **`lib/types/api.ts`** + Zod + repository + routes together (**contract freeze** above).

---

## `lib/validation/api-requests.ts`

Zod schemas for: `call/start`, `call/turn`, **`call/end`** (requires **`reason` or `outcome`**), `operator/takeover`, **`operator/update-incident`**, **`operator/resolve`**, **`operator/send-sms`**, simulate batch (**`batch_size`** `0..100`, **`offset`**, optional **`reset_existing`**).

---

## `lib/server/demo-store.ts` (in-memory)

Still the backing store when Supabase service role is unavailable. **`appendSeedTranscriptEvents`** mirrors simulate **`transcript_events`** inserts for in-memory runs. **Test helpers:** **`resetDemoStore()`**, **`getDemoStoreSizes()`** — used by Vitest for isolated `call-repository` tests.

---

## Testing (`vitest`)

| Item    | Location / command                                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config  | `vitest.config.ts` — `environment: "node"`, `include: ["lib/**/*.test.ts"]`, `@` path alias                                                                                                   |
| Scripts | `npm run test` (watch), `npm run test:run` (CI)                                                                                                                                               |
| Suites  | `lib/validation/api-requests.test.ts`, `lib/db/mappers.test.ts`, `lib/server/api-route-helpers.test.ts`, `lib/db/call-repository.test.ts` (memory path, simulate offset burn, world-cup mode) |

**IDs:** `lib/server/ids.ts` uses **`node:crypto`** `randomUUID()` so tests and Node 18 environments work without global `crypto`.

---

## `lib/ai/*` (overlap with Member 3)

Mock triage agent and schema validation unchanged in spirit; repository final-turn path uses **`runCallTriageAgent`** → **`merge-triage-output`** + persisted state (including **AI transcript** line). **Still missing per plan:** native **Featherless** provider path; optional multi-step **`runControlledAgent`** loop if the team adopts it beyond the current two-pass tool loop.

---

## Gaps / next steps (priority)

1. **RLS / anon reads** — **`20260507194500_*`** enables broad anon **SELECT** for dashboard Realtime; **`app/page.tsx`** vs **`/dashboard`** should stay aligned with product security expectations—tighten policies and roles before production.
2. ~~**`POST /api/surge/analyze`**~~ — **Done (baseline).** Extend **`runSurgeGeoOpsAgent`** with model + tool loop; wire dashboard / demo to call analyze when needed (**`project_plan`** §14.3).
3. **Browser E2E** — Playwright (or similar) smoke: start → turn → end against `next dev` (automate what **`/dev/voice-sim`** does manually).
4. **CI** — Run `npm run test:run` + `npm run lint` + `npx tsc --noEmit` on push (**`project_plan`** §139–§151).
5. **Dashboard shell (remainder)** (`project_plan` §188–§192) — **`call_sessions`** Realtime, regional / surge-layer strategy, embed or link **`/dev/voice-sim`** call controls if required by DoD (drawer **transcript Realtime** + cluster fly-to **landed** in this pass).

---

## Quick file map (post-integration)

| Area                         | Files                                                                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types                        | `lib/types/{index,api,domain,enums,geo,json,tools}.ts`                                                                                                                                  |
| Supabase                     | `lib/supabase/{env,server,client,middleware,service}.ts`                                                                                                                                |
| DB / persistence             | **`lib/db/{call-repository,mappers,incident-row,call-session-row}.ts`**, **`lib/db/*.test.ts`**                                                                                         |
| API backing (RAM)            | `lib/server/{demo-store,merge-triage-output,ids,iso-now,api-route-helpers,responders-mock-data,simulate-seed-enrichment}.ts`                                                            |
| Dashboard feed (client)      | **`lib/data/apiIncidentDataSource.ts`**, **`lib/data/dashboardIncidentFeed.ts`**, **`lib/data/supabaseTranscriptDataSource.ts`**, **`lib/data/dashboardCommandApi.ts`**, **`lib/http/postJson.ts`**, **`lib/data/simulationClient.ts`** |
| Dashboard persona            | **`lib/dashboard/dashboardPersona.ts`**, **`components/dashboard/DashboardPersonaContext.tsx`**                                                                                     |
| Simulate / map geometry      | **`lib/mock/simulate-seed-geometry.ts`**, **`lib/mock/disasterLayers.ts`**                                                                                                            |
| HTTP Zod                     | `lib/validation/api-requests.ts`, **`api-requests.test.ts`**                                                                                                                            |
| Route helpers                | **`lib/server/api-route-helpers.test.ts`**                                                                                                                                              |
| Triage                       | `lib/ai/agents/{mockCallTriageAgent,callTriageAgent}.ts`, `lib/ai/providers/gemmaClient.ts`, `lib/ai/{schemas,prompts,examples,README,BACKEND_INTEGRATION}.md`                          |
| Voice sim (payload builders) | **`lib/simulate/elevenlabs-voice-sim.ts`**                                                                                                                                              |
| Mapbox dashboard             | **`app/dashboard/page.tsx`**, **`components/dashboard/*`**, **`components/map/CommandMap.tsx`**, **`components/incidents/*`**                                                           |
| Dev UI                       | **`app/dev/voice-sim/page.tsx`**, **`components/dev/VoiceSimSimulators.tsx`**, **`components/dev/ElevenLabsVoiceSimulator.tsx`**, **`components/dev/OperatorFlowSimulator.tsx`**   |
| Dev API                      | **`app/api/dev/{persistence,incidents,call-sessions,triage-preview}/route.ts`**                                                                                                         |
| Surge / GeoOps               | **`app/api/surge/analyze/route.ts`**, **`lib/surge/*`**, **`repositorySurgeAnalyze`**                                                                                                   |

---

_Last updated: **Disaster + World Cup seed expansion** (29 disaster scenarios, 13 multilingual world-cup scenarios, +9 mock responders incl. `event_staff`), **`event_layers` SQL seed migration** (16 world_cup + 5 disaster layers) wired into **`repositorySimulateWorldCup`** via **`mapEventLayerRow`**, **`vitest` + `zod` pinned in `package.json`** with new `test` / `test:run` / `typecheck` scripts and `vitest.config.ts`. Previously: Transcript Realtime + `transcript_events` seeding, AI `say_to_caller` transcript rows after final triage, simulate–map geometry (`simulate-seed-geometry` / `EVENT_ZONES` / `disasterLayers`), dashboard personas + tabbed drawer + cluster fly-to, `VoiceSimSimulators` hydration, disaster simulate `maxCap: 100` / default batch 50, direct `mapbox-gl` dependency._
