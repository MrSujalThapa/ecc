# ECC Polish Sprint — Final Demo Script

Audience: operators, sponsors, and engineers demonstrating the **Emergency Command Center** after the polish sprint on branch `polish/full-agent-runtime-polish`.

Companion doc: [final_verification_checklist.md](./final_verification_checklist.md).

Ground truth for polish scope: [phase_execution_log.md](./phase_execution_log.md). Some narrative docs (for example older summaries in `docs/backend_architecture_current.md`) may lag the polished code; trust the execution log and source files cited below.

---

## 1. Project overview

The **Emergency Command Center (ECC)** ties together:

- **Voice ingress**: callers reach an AI-assisted voice layer (Twilio + ElevenLabs in live setups); structured turns run through backend triage.
- **Structured triage**: bounded JSON agent output, backend validation, and server-side tool execution (`repositoryCallTurn` / `runEmergencyTurn`).
- **Operator dashboard**: Mapbox map, incident queue, incident and cluster drawers, operator actions (SMS, takeover, etc.), and demo simulations.

The dashboard supports operating **modes** (for example normal, disaster, world/event surge). Demo controls can seed incidents without a live PSTN call.

---

## 2. What was fixed during polish

Summarized from [phase_execution_log.md](./phase_execution_log.md). Phases **18–20** are the latest UI-focused polish; phases **3–17** established the unified runtime, voice alignment, telephony/SMS reliability, Mapbox MCP geocode path, transfer/advisory wiring, GeoOps API alignment, dashboard hydration, and operator-facing trace panels.

### Spine (Phases 3–17, highlights)

- **Phase 3–4**: Introduced `runEmergencyTurn()` and routed `POST /api/call/turn` through it (same HTTP response shape).
- **Phase 5**: ElevenLabs `llm_turn` awaits `runEmergencyTurn()` so the spoken line aligns with validated triage **`say_to_caller`** (`app/api/elevenlabs/webhook/route.ts`).
- **Phase 6**: Improved **`caller_phone`** lifecycle for SMS recipient lookup across Twilio, session store, EL bootstrap, and repository paths.
- **Phase 7**: Transfer recommendation metadata from triage/runtime (advisory, gated — no unsafe auto-transfer).
- **Phases 8–10**: Mapbox MCP scaffolding, MCP geocode tool, and **`geocode_location`** delegating to MCP with mock/static fallback.
- **Phase 11**: Tool result provenance surfacing.
- **Phase 12**: Deterministic **Operator Assignment Agent Core** (`lib/dispatch/operatorAssignmentEngine.ts`) — advisory only, not persisted preemption.
- **Phase 13**: Advisory **transfer recommendation** connected to advisory operator assignment in `runEmergencyTurn`.
- **Phase 14**: **`/api/surge/analyze`** aligned with **`repositorySurgeAnalyze`**; backend cluster metadata (`source`, `priority_score`) on persisted clusters.
- **Phase 15**: Dashboard **initial hydration** fixed so the queue does not hang when browser Supabase env is missing (API fallback still runs).
- **Phase 16**: **AI Trace** panel in drawer (honest about missing deep runtime trace).
- **Phase 17**: **Incident timeline** on triage tab (best-effort from incident + session fields).

### Recent UI polish (Phases 18–20)

- **Phase 18**: **SMS and transfer status** clarity in `CallControlPanel` (via `buildSmsStatusView` / `buildTransferStatusView`); `activeCallSession` passed from `IncidentDrawer`.
- **Phase 19**: **Cluster source** provenance — `deriveSurgeClusters` tags **`backend_geoops`** vs **`client_fallback`**; `ClusterDrawer` shows badge, explanation, and **`priority_score`** when present.
- **Phase 20**: **Multilingual visibility** — `MultilingualTracePanel`, `buildMultilingualSummary`, clearer `LiveTranscriptPanel` labels (language code, English line only when **`translated_text`** exists).

---

## 3. Main demo flow (dashboard-first)

**Prerequisites**

1. `git checkout polish/full-agent-runtime-polish` and `git pull`.
2. Install deps (`npm install`) if needed.
3. Start the app: `npm run dev` (or `npm.cmd run dev` if PowerShell blocks `npm.ps1`).
4. Configure env per [final_verification_checklist.md](./final_verification_checklist.md). For a **minimal** dashboard demo, `NEXT_PUBLIC_MAPBOX_TOKEN` is needed for the map; Supabase browser keys enable realtime + direct reads, while missing anon keys still allow **`GET /api/dev/incidents`** fallback after Phase 15’s hydration fix.

**Walkthrough**

1. Open the command dashboard (path depends on app routing; typically the main dashboard page using `DashboardShell`).
2. Confirm the **incident queue** loads. If you use Supabase realtime, watch the top bar / status; use **Refresh** if you are on a minimal env without live subscription.
3. **Select an incident** from the queue; the **incident drawer** opens.
4. **Triage** tab:
   - **Incident timeline** (lifecycle milestones from available fields).
   - **Multilingual trace** (caller language, translation status, transcript availability — or explicit “not available”).
   - **AI Trace** (provider-adjacent signals the drawer actually has; no fabricated tool/provider claims).
5. **Operator** tab:
   - **Call control / SMS**: observe **caller phone / recipient** availability and SMS state (ready, missing recipient, sent, stub/unavailable, error). Last SMS outcome may be reflected from local UI state for honest labeling.
   - **Transfer / escalation**: advisory states only (operator required, escalation, transfer phase from session — **UI does not imply a live bridge unless session status supports it**).
6. **Details** tab: incident fields and context as implemented.
7. **Live voice** tab: **Live transcript** with row labels (transcript, language when present, English translation line only when **`translated_text`** exists).
8. **Map**: incident pins, optional heatmap/cluster layers. **Select a cluster** (when clusters are shown) to open **ClusterDrawer**:
   - **Backend GeoOps** vs **Client fallback** vs **Unknown** per `buildClusterSourceView`.
   - **priority_score** when present for backend-backed clusters.

---

## 4. Optional live-call flow

Use only with **Twilio + ElevenLabs** (and AI provider keys) configured; this is optional for sponsor demos.

1. Ensure `TWILIO_*`, `ELEVENLABS_*`, and triage provider env (for example **`FEATHERLESS_*`** / **`GEMMA_*`**, **`AI_PROVIDER`**) are set per checklist.
2. Place a test call to the configured Twilio number.
3. Observe:
   - Session and incident creation in the dashboard (per persistence mode: Supabase vs in-memory demo-store).
   - Transcript rows appearing under **Live voice** when realtime/Supabase or refetch paths are active.
   - After a final turn on the EL path, the **spoken** content should follow the same **`say_to_caller`** produced by **`runEmergencyTurn`** (see Phase 5 notes in the execution log).

**Honesty**: PSTN latency, webhook signing (`ELEVENLABS_WEBHOOK_SECRET`), and provider outages can still produce fallback paths — narrate those as environmental, not product guarantees.

---

## 5. Simulation-only fallback flow

No telephony required.

1. Use dashboard **Demo controls** (or direct `POST /api/simulate/disaster` / `POST /api/simulate/world-cup` if exercising APIs).
2. Confirm new incidents appear in the queue and on the map (coordinates permitting).
3. Open an incident and walk **Section 3** tabs — SMS may show **stub** behavior if Twilio is unset; cluster badges may show **Client fallback** unless incidents carry persisted **`cluster_id`** from backend GeoOps flows.

---

## 6. Expected dashboard observations

- **Queue + map**: incidents listed and plotted when coordinates exist; static/mock fallback data only when APIs return empty/errors (see dataflow docs).
- **Realtime**: when browser Supabase env is configured, incidents and transcripts may update live; otherwise rely on refresh and dev API routes.
- **Drawers**: incident drawer tabs (**Triage**, **Operator**, **Details**, **Live voice**); cluster drawer shows **source** + **priority_score** when applicable.
- **No false confidence**: panels state when multilingual details, deep runtime trace, or tool-level trace are **not** available in the drawer.

---

## 7. What to point out technically

| Topic | Where / what to say |
|--------|---------------------|
| **Unified emergency runtime** | `lib/runtime/runEmergencyTurn.ts` wraps `repositoryCallTurn` and adds advisory projections (`transfer_recommendation`, `operator_assignment`). |
| **ElevenLabs uses validated `say_to_caller`** | `app/api/elevenlabs/webhook/route.ts` — `llm_turn` success path awaits **`runEmergencyTurn`** and returns **`say_to_caller`** from that result (Phase 5). |
| **Mapbox MCP-backed geocode path with fallback** | `lib/tools/geocodeLocation.ts` tries **`geocodeWithMapboxMcp`**; on unavailable/error falls back to deterministic mock/static behavior (`lib/tools/mapbox/geocodeWithMapboxMcp.ts`, MCP env in `lib/tools/mapbox/mapboxToolConfig.ts`). |
| **caller_phone / SMS reliability** | Phase 6 repository + voice paths; SMS UI Phase 18 — recipient missing vs ready; Twilio unset → stub path in `sendSms`. |
| **Advisory transfer recommendation** | Derived in `runEmergencyTurn` from triage actions + session/incident signals — **not** Safe Transfer Execution. |
| **Operator Assignment Agent Core** | `lib/dispatch/operatorAssignmentEngine.ts` — deterministic, advisory, no preemption; wired as advisory output from runtime (Phase 12–13). |
| **Backend GeoOps provenance** | Persisted **`cluster_id`** / **`priority_score`** on incidents; **`deriveSurgeClusters`** sets `source: "backend_geoops"` vs **`client_fallback`**; `ClusterDrawer` + `buildClusterSourceView` (Phase 14 + 19). |
| **AI Trace panel** | `components/incidents/AITracePanel.tsx` + `lib/dashboard/buildAITraceSummary.ts` (Phase 16). |
| **Incident timeline** | `components/incidents/IncidentTimeline.tsx` + `lib/dashboard/buildIncidentTimeline.ts` (Phase 17). |
| **SMS / transfer status clarity** | `lib/dashboard/buildOperatorCommStatus.ts`, `CallControlPanel`, `IncidentDrawer` (Phase 18). |
| **Multilingual visibility** | `MultilingualTracePanel`, `buildMultilingualSummary`, `LiveTranscriptPanel` (Phase 20). |

**IBM / watsonx**: only claim live translation when **`IBM_TRANSLATION_ENABLED=true`** and IBM env is configured (`lib/voice/transcriptTranslation.ts`). Otherwise describe the UI as showing **available transcript language fields only**.

---

## 8. Known limitations

1. **Safe Transfer Execution is not implemented** — no end-to-end gated Twilio bridge driven safely from triage approval in this sprint; **`POST /api/twilio/transfer`** exists but productized safe transfer is **post–Phase 21** backlog.
2. **Operator assignment is advisory** — recommendations are not a persisted real-time dispatch system.
3. **Detailed runtime trace is not fully persisted into drawer data** — AI Trace and timeline are honest about gaps; full tool/agent replay is backlog.
4. **Dashboard timeline is best-effort** — derived from incident + optional active session fields, not a complete audit stream.
5. **No full real responder DB** — responder tools and map layer use mock/static data (`getMockResponders` / `/api/responders/mock`).
6. **No full production auth / RBAC / security hardening** — dev routes and permissive webhook verification when secrets are empty are demo-oriented.

---

## Master-plan verification note

[master_project_plan.md](./master_project_plan.md) Phase 21 asks that **two independent readers** run one end-to-end path from this script without blockers. Record completion of that exercise in [phase_execution_log.md](./phase_execution_log.md) when true.
