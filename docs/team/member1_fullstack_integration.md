# Member 1 — Fullstack / integration status

**Sources:** [`project_plan.md`](../project_plan.md) (Member 1, Main Steps 1–2, contract freeze, Definition of Done), [`project_details.md`](../project_details.md) (§5 workflow, §12 schema, §11 backend layout, AI boundaries), [`api_contracts.md`](../api_contracts.md) (HTTP + domain contracts). Legacy: `project_full_context_and_future_features.md` §1–§10 (core pipeline; §11+ out of scope for early build).

**Contract source of truth for HTTP shapes:** [`docs/api_contracts.md`](../api_contracts.md) — aligned with `lib/types/api.ts` and route handlers.

This note tracks **`lib/`**, **`app/api/*`**, **`app/dev/*`**, persistence (Supabase vs in-memory), the **voice-path E2E harness**, and automated tests from the integration pass.

---

## Role checklist (`project_details` §19 / `project_plan` §73–§100)

| Responsibility | Status | Where / notes |
|----------------|--------|----------------|
| Repository structure | **Advanced** | `lib/types`, `lib/server`, `lib/supabase`, `lib/ai`, `lib/validation`, **`lib/db/*`**, **`lib/tools/*`**, **`lib/surge/*`** (GeoOps input builder for **`/api/surge/analyze`**). `lib/voice/*` exists for webhooks. |
| Shared types | **Done** | `lib/types/` — domain in `domain.ts`; **`lib/types/api.ts`** aligned with **`docs/api_contracts.md`** (call start/turn/end, operator, simulate, responders). |
| Dashboard shell | **Partial** | **`/dashboard`** (`app/dashboard/page.tsx` + `DashboardShell`): incident list from **`GET /api/dev/incidents`** via **`lib/data/apiIncidentDataSource.ts`**, optional **Supabase Realtime** on `public.incidents` (`lib/data/dashboardIncidentFeed.ts`), queue + drawer + **`DemoControls`** (simulate batch + `reset_existing`), **`CommandMap`** with Mapbox when **`NEXT_PUBLIC_MAPBOX_TOKEN`** is set or **`CommandMapOffline`** otherwise, drawer **`IncidentDrawerActions`** → **`POST /api/operator/*`** via **`lib/data/dashboardCommandApi.ts`**, call-session summary via **`GET /api/dev/call-sessions`**. **Still open vs plan:** map clusters / surge sync / full Step 11 Realtime on sessions & transcripts. |
| Supabase client | **Done** | `lib/supabase/{env,server,client,middleware}.ts` + **`lib/supabase/service.ts`** (service-role server client, no session). Root `middleware.ts` where present. |
| Migrations / schema | **Done (SQL)** | `supabase/migrations/*`; RLS on tables. **`20260507194500_anon_select_incidents_sessions_transcripts.sql`** adds **anon SELECT** on `incidents`, `call_sessions`, `transcript_events` for browser Realtime + read models (tighten before production). |
| API persistence | **Dual path** | **`lib/db/call-repository.ts`**: uses **`getServiceRoleClient()`** when `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise **`lib/server/demo-store.ts`** (RAM). |
| Integration checks | **Partial** | **`npm run test` / `npm run test:run`** (Vitest on `lib/**/*.test.ts`). **Browser:** [`/dev/voice-sim`](../../app/dev/voice-sim/page.tsx) exercises `call/start` → `call/turn` → `call/end` without Postman. No Playwright/Cypress in repo yet. |
| Deployment / CI | **Not done** | No GitHub Actions; `.env.example` documents env vars (including optional **`NEXT_PUBLIC_MAPBOX_TOKEN`** for the dashboard map). |

---

## Main Step 1 — contracts (`project_plan` §154–§172)

| Substep | Doc expectation | Repo |
|---------|-----------------|------|
| 1.1 Shared TS types | `Incident`, `CallSession`, `TranscriptEvent`, `Responder`, `EventLayer`, modes/enums | **Met** in `lib/types/domain.ts`, `enums.ts`, `geo.ts`, `json.ts`. |
| 1.2 API contracts | HTTP request/response shapes | **Met** in **`docs/api_contracts.md`** and **`lib/types/api.ts`** — e.g. `CallStartResponse` includes full `incident` + `call_session`; `CallTurnResponse` includes `transcript_event` and `actions: SystemAction[]`; `CallEndRequest` supports `reason` and legacy `outcome`; operator update/resolve/send-sms; simulate disaster/world-cup responses with `created_incidents` / `created_call_sessions`. |
| 1.3 AI Zod schema | Triage output validated | **Met** in `lib/ai/schemas/triageAgentOutputSchema.ts`; exports used by API types include **`SystemAction`**, tool request types where wired. |

**Contract freeze:** Changing `Incident` / `CallSession` / triage Zod / public API shapes still requires coordinated updates (mock agent, `merge-triage-output`, `call-repository`, routes, future UI).

---

## Main Step 2 — foundation (`project_plan` §174–§192)

| Substep | Doc expectation | Status |
|---------|-----------------|--------|
| 2.1 App folders | `app/api`, `components`, `lib`, `supabase` | **`app/api`** (call, operator, simulate, responders, **dev**), **`app/dev`** (voice sim), **`components/`** (includes **`components/dev/`**), **`lib/`**, **`supabase/migrations`**; README varies. |
| 2.2 Supabase integration | Client + migrations + read/write proof | **Service path:** inserts/updates/selects via **`lib/db/call-repository.ts`** when service role env is configured. **Fallback:** in-memory **`demo-store`** for local/demo without Supabase. **`app/page.tsx`** uses **server** Supabase client (anon) — separate from API persistence. |
| 2.3 Dashboard shell | Dashboard route, regions, mock incidents (`project_plan` §188–§192) | **Partial:** **`/dashboard`** ships queue, map column (Mapbox or offline list), incident drawer with operator actions + API-backed call-session block, demo simulation strip, Realtime-driven refetch. **Remaining:** clusters/regions, mock-incident strategy per doc, full Mapbox polish (Member 4). **Minimal call-path UI** remains **`/dev/voice-sim`**. |

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
  - **`lib/server/simulate-seed-enrichment.ts`**: disaster / world-cup seeds get **Toronto-area `coordinates`** and richer scenario fields after each `repositoryCallStart` in the simulate loop (map pins + drawer copy).
- **Supporting endpoints / dev harness**
  - `GET /api/responders/mock`
  - Dev harness: `/dev/voice-sim` + `GET /api/dev/persistence`
  - Operator dev simulator: `GET /api/dev/incidents` + UI that drives `/api/operator/*`
  - **`GET /api/dev/call-sessions?incident_id=`** — lists `call_sessions` for one incident (dashboard drawer + debugging)
  - Dev-only triage dry-run: `POST /api/dev/triage-preview` (runs `runCallTriageAgent` with no DB writes)
- **Main Step 11 — Realtime (partial)**
  - **`/dashboard`** subscribes to **`public.incidents`** via Supabase Realtime (browser client) and **refetches** `GET /api/dev/incidents` on change.
  - Requires **`NEXT_PUBLIC_SUPABASE_URL`** + **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** (or anon) **and** migration **`20260507194500_anon_select_incidents_sessions_transcripts.sql`** applied so anon can **SELECT** (Realtime uses the same permission model as PostgREST reads).
  - Still missing: Realtime on **`call_sessions`** / optional **`transcript_events`** (drawer uses **`LiveTranscriptPanel`** when Supabase Realtime is enabled for that table), Map-driven cluster sync (full Step 11 scope).
- **Main Step 14 — Surge / GeoOps (baseline, Member 1)**
  - **`POST /api/surge/analyze`**, **`lib/surge/buildSurgeGeoOpsAgentInput.ts`**, **`repositorySurgeAnalyze`**: validated **`runSurgeGeoOpsAgent`** output, persists **`cluster_id`** + rank-derived **`priority_score`**, audit log. **`GEOOPS_PROVIDER`** (fallback **`AI_PROVIDER`**) is passed into the agent for the next integration step.

### Not done yet (gaps vs docs)

- **Main Step 2.3 / Steps 4–5 (remainder)**: map **clusters** / regions, surge-driven map behaviour, full Definition-of-Done polish for dashboard UX (baseline `/dashboard` + Mapbox/offline map + queue + drawer **is in repo**)
- **Main Step 10 (remainder)**: production hardening (e.g. Twilio signature verification), real SMS sending beyond operator stub — webhooks + **`lib/voice/*`** are in repo
- **Main Step 11 (remainder)**: Realtime for **`call_sessions`** / **`transcript_events`**, Mapbox live sync polish, loading/error UX per Definition of Done
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
- **`components/incidents/IncidentDrawer.tsx`**: **`activeCallSession`** block when **`GET /api/dev/call-sessions`** returns rows; renders **`IncidentDrawerActions`** when **`onAfterCommand`** provided.

### Debugging support

- `.vscode/launch.json` provides:
  - `Next.js: dev (debug)` (Node inspector on `9229`)
  - `Next.js: attach (9229)`

## `lib/db/*` — persistence layer (new / expanded)

| File | Role |
|------|------|
| **`call-repository.ts`** | Orchestrates `repositoryCallStart`, `repositoryCallTurn`, `repositoryCallEnd`, `repositoryOperatorTakeover`, `repositoryOperatorUpdateIncident`, `repositoryOperatorResolve`, `repositoryOperatorSendSms` (stub), `repositorySimulateDisaster`, `repositorySimulateWorldCup`, **`repositoryListIncidentsForDev`**, **`repositoryListCallSessionsForDev`**. Memory vs Supabase branches; audit hooks on Supabase. |
| **`mappers.ts`** | `mapIncidentRow`, `mapCallSessionRow`, `mapTranscriptRow` — PostgREST/jsonb → `lib/types/domain`. |
| **`incident-row.ts`** / **`call-session-row.ts`** | `incidentToDb` / `callSessionToDb` and insert row builders for migrations column names. |

Routes **`app/api/**/route.ts`** import the repository (not `demo-store` directly) and map thrown errors via **`repositoryErrorResponse`** in **`lib/server/api-route-helpers.ts`** (`NOT_FOUND`, `SESSION_MISMATCH`, `SESSION_INACTIVE`, `SESSION_MISSING`).

**Removed:** `lib/server/run-simulate-batch.ts` — simulate routes call **`repositorySimulateDisaster` / `repositorySimulateWorldCup`** directly.

---

## `app/api/*` route inventory

| Method | Path | Handler notes |
|--------|------|-----------------|
| POST | `/api/call/start` | `repositoryCallStart` → 201 + full incident/session |
| POST | `/api/call/turn` | `repositoryCallTurn` |
| POST | `/api/call/end` | `repositoryCallEnd` (`reason` and/or `outcome`) |
| POST | `/api/operator/takeover` | `repositoryOperatorTakeover` |
| POST | `/api/operator/update-incident` | `repositoryOperatorUpdateIncident` |
| POST | `/api/operator/resolve` | `repositoryOperatorResolve` |
| POST | `/api/operator/send-sms` | `repositoryOperatorSendSms` (returns `sent: false` stub) |
| POST | `/api/simulate/disaster` | `repositorySimulateDisaster` (`maxCap: 29` in route; passes **`reset_existing`**) |
| POST | `/api/simulate/world-cup` | `repositorySimulateWorldCup` (`maxCap: 50` in route; passes **`reset_existing`**) |
| POST | `/api/surge/analyze` | `repositorySurgeAnalyze` — GeoOps clusters + **`cluster_id`** / **`priority_score`** on cohort (`api_contracts` §4.11) |
| GET | `/api/responders/mock` | Responders mock data for map (`api_contracts` §4.8) |
| GET | `/api/dev/persistence` | `{ uses_supabase: boolean }` — safe for browser; indicates whether `call-repository` uses service-role Supabase vs `demo-store` |
| GET | `/api/dev/incidents` | `repositoryListIncidentsForDev` — dashboard + operator sim |
| GET | `/api/dev/call-sessions` | `repositoryListCallSessionsForDev` — query `incident_id` |
| POST | `/api/dev/triage-preview` | Dry-run `runCallTriageAgent` (no DB writes) |

---

## Voice-path E2E harness (integration work)

Purpose (**`project_details.md`** intake narrative): exercise **Twilio/ElevenLabs-shaped** traffic against the **real** `POST /api/call/*` handlers so teammates can see **`incidents`**, **`call_sessions`**, **`transcript_events`**, **`audit_logs`** in Supabase without voice infra.

| Piece | Role |
|-------|------|
| **`lib/simulate/elevenlabs-voice-sim.ts`** | Builds **`CallStartRequest`** / **`CallTurnRequest`** bodies (`source: "simulate"`, sample utterances) aligned with **`api_contracts`** §4.1–4.2. |
| **`components/dev/ElevenLabsVoiceSimulator.tsx`** | Client UI: start call, **partial** vs **final** turn (`is_final` — finals run triage per **`project_details`** / repository behavior), end call. Uses **`mounted`** guard to avoid React hydration mismatches on `disabled`. |
| **`app/dev/voice-sim/page.tsx`** | Dev route **`/dev/voice-sim`**. |
| **`GET /api/dev/persistence`** | Explains whether **`SUPABASE_SERVICE_ROLE_KEY`** is set (**`api_contracts` / `project_plan`**: backend owns writes; service role for server-side inserts — **publishable/anon keys alone are not enough** for this repository path). |

**Env reminder (`project_plan` §176–§180, `.env.example`):** `NEXT_PUBLIC_SUPABASE_URL` + **`SUPABASE_SERVICE_ROLE_KEY`** → Supabase persistence from API routes. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or anon) → browser/middleware client only. Optional **`NEXT_PUBLIC_MAPBOX_TOKEN`** → Mapbox **`CommandMap`**; if unset, **`CommandMapOffline`** still drives selection from the middle column.

---

## Integration tips for other parts

Use **`docs/api_contracts.md`** as the shape contract; **`docs/project_details.md`** for pipeline semantics; **`docs/project_plan.md`** for phased ownership and Definition of Done.

### Voice / telephony (Member 2 — `project_details` §5, §11)

- Send **committed utterances** as **`POST /api/call/turn`** with **`is_final: true`** to run triage; **`is_final: false`** for interim STT if you want transcript rows without triage (**`project_details`** partial vs final).
- Populate **`twilio_call_sid`** / **`elevenlabs_conversation_id`** on **`POST /api/call/start`** when available so sessions trace back to providers (**`api_contracts`** §4.1).
- Use **`CallTurnResponse.say_to_caller`** (and updated `incident` / `call_session`) to drive the next voice prompt — do not bypass the backend to mutate incidents (**`api_contracts`** contract rules; **`project_details`** “backend validates and executes”).

### Dashboard / Mapbox (Member 4 — `project_plan` §182–§192, §251+, `project_details` §4 stack table)

- Map and queue UI must use the **same** `Incident`, `CallSession`, `TranscriptEvent` field names and enums as **`api_contracts`** — no duplicate “demo-only” types (**`api_contracts`** §Contract Rules).
- **`/dashboard`** today: list from **`GET /api/dev/incidents`**; **Realtime** refetches that list on **`public.incidents`** changes when anon env + migration allow reads; **Mapbox** renders **markers only for incidents with `coordinates`** (simulate disaster/world-cup seeds set Toronto pins via **`mergeSimulatedSurgeRow`**). Without **`NEXT_PUBLIC_MAPBOX_TOKEN`**, **`CommandMapOffline`** still shares **`selectedIncidentId`** with the queue.
- After **`/api/operator/*`** or **`/api/call/*`**, the drawer uses **`onAfterCommand`** → full list refetch + **`GET /api/dev/call-sessions`** for the selected incident; Realtime covers concurrent incident row changes.
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

Still the backing store when Supabase service role is unavailable. **Test helpers:** **`resetDemoStore()`**, **`getDemoStoreSizes()`** — used by Vitest for isolated `call-repository` tests.

---

## Testing (`vitest`)

| Item | Location / command |
|------|---------------------|
| Config | `vitest.config.ts` — `environment: "node"`, `include: ["lib/**/*.test.ts"]`, `@` path alias |
| Scripts | `npm run test` (watch), `npm run test:run` (CI) |
| Suites | `lib/validation/api-requests.test.ts`, `lib/db/mappers.test.ts`, `lib/server/api-route-helpers.test.ts`, `lib/db/call-repository.test.ts` (memory path, simulate offset burn, world-cup mode) |

**IDs:** `lib/server/ids.ts` uses **`node:crypto`** `randomUUID()` so tests and Node 18 environments work without global `crypto`.

---

## `lib/ai/*` (overlap with Member 3)

Mock triage agent and schema validation unchanged in spirit; repository final-turn path uses **`runCallTriageAgent`** → **`merge-triage-output`** + persisted state. **Still missing per plan:** native **Featherless** provider path, **`lib/tools/`** executors, controlled multi-step **`runControlledAgent`** loop if the team adopts it.

---

## Gaps / next steps (priority)

1. **RLS / anon reads** — **`20260507194500_*`** enables broad anon **SELECT** for dashboard Realtime; **`app/page.tsx`** vs **`/dashboard`** should stay aligned with product security expectations—tighten policies and roles before production.
2. ~~**`POST /api/surge/analyze`**~~ — **Done (baseline).** Extend **`runSurgeGeoOpsAgent`** with model + tool loop; wire dashboard / demo to call analyze when needed (**`project_plan`** §14.3).
3. **Browser E2E** — Playwright (or similar) smoke: start → turn → end against `next dev` (automate what **`/dev/voice-sim`** does manually).
4. **CI** — Run `npm run test:run` + `npm run lint` + `npx tsc --noEmit` on push (**`project_plan`** §139–§151).
5. **Dashboard shell (remainder)** (`project_plan` §188–§192) — clusters, surge layers, transcript Realtime in drawer, embed or link **`/dev/voice-sim`** call controls if required by DoD.

---

## Quick file map (post-integration)

| Area | Files |
|------|--------|
| Types | `lib/types/{index,api,domain,enums,geo,json,tools}.ts` |
| Supabase | `lib/supabase/{env,server,client,middleware,service}.ts` |
| DB / persistence | **`lib/db/{call-repository,mappers,incident-row,call-session-row}.ts`**, **`lib/db/*.test.ts`** |
| API backing (RAM) | `lib/server/{demo-store,merge-triage-output,ids,iso-now,api-route-helpers,responders-mock-data,simulate-seed-enrichment}.ts` |
| Dashboard feed (client) | **`lib/data/apiIncidentDataSource.ts`**, **`lib/data/dashboardIncidentFeed.ts`**, **`lib/data/dashboardCommandApi.ts`**, **`lib/http/postJson.ts`**, **`lib/data/simulationClient.ts`** |
| HTTP Zod | `lib/validation/api-requests.ts`, **`api-requests.test.ts`** |
| Route helpers | **`lib/server/api-route-helpers.test.ts`** |
| Triage | `lib/ai/agents/{mockCallTriageAgent,callTriageAgent}.ts`, `lib/ai/providers/gemmaClient.ts`, `lib/ai/{schemas,prompts,examples,README,BACKEND_INTEGRATION}.md` |
| Voice sim (payload builders) | **`lib/simulate/elevenlabs-voice-sim.ts`** |
| Mapbox dashboard | **`app/dashboard/page.tsx`**, **`components/dashboard/*`**, **`components/map/CommandMap.tsx`**, **`components/incidents/*`** |
| Dev UI | **`app/dev/voice-sim/page.tsx`**, **`components/dev/ElevenLabsVoiceSimulator.tsx`** (`POST /api/dev/triage-preview` dry-run shares `runCallTriageAgent`) |
| Dev API | **`app/api/dev/{persistence,incidents,call-sessions,triage-preview}/route.ts`** |
| Surge / GeoOps | **`app/api/surge/analyze/route.ts`**, **`lib/surge/*`**, **`repositorySurgeAnalyze`** |

---

*Last updated: **`POST /api/surge/analyze`**, **`lib/surge/buildSurgeGeoOpsAgentInput`**, rank-based **`priority_score`** persistence, **`GEOOPS_PROVIDER`** handoff for GeoOps model work; dashboard auto-call to analyze + CI smoke still open.*
