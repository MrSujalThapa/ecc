# ECC Agent Runtime Polish Master Plan

Hackathon-polish scope: unify agent runtime behavior, make validated triage the spine for voice + UI, harden SMS/transfer/dashboard demos, and improve observability—without boiling the ocean.

---

## 1. Goal

ECC should become a **cleaner agentic emergency coordination** codebase where:

- **Unified emergency turn runtime** — One coherent pipeline wraps persistence + triage + actions instead of divergent “voice prose” vs “structured DB” paths.
- **Validated triage as source of truth** — JSON outputs pass backend validation; tool execution stays server-side; bounded loops remain (**max two LLM passes**).
- **ElevenLabs speaks validated `say_to_caller`** — Custom LLM / PSTN callers hear the same utterance the structured pipeline chose (within latency budgets).
- **Mapbox MCP-backed tool layer** — Backend-invoked tools can reach Mapbox MCP (with explicit fallback when MCP/token unavailable).
- **Reliable SMS / caller phone flow** — `caller_phone` is populated whenever telephony provides it; SMS surfaces clear recipient vs failure.
- **Transfer recommendation + operator assignment logic** — Triage can emit guarded recommendations; assignment/transfers respect gates (no unsafe auto-bridge without approval).
- **Backend GeoOps authority** — Surge/cluster persistence and APIs align so the dashboard can distinguish backend clusters from client-only derivations.
- **Dashboard AI trace / tool timeline** — Operators see provider, tools, validation, and lifecycle—not only raw transcripts.
- **Demo-ready verification** — Build, tests, lint, and a short demo script prove one happy path end-to-end.

---

## 2. Current Problems We Are Fixing

*Ground truth:* `docs/codebase_implementation_audit.md`, `docs/backend_architecture_current.md`, `docs/triage_agent_current_runtime.md`, `docs/frontend_backend_dataflow.md`.

| Area | Problem |
|------|---------|
| **Split-brain ElevenLabs path** | `llm_turn` can return a **separate Featherless/voice completion** while **`repositoryCallTurn`** runs **asynchronously**—caller audio may not match persisted `say_to_caller` / transcript narrative. |
| **Triage not single source for spoken response** | Structured triage (`repositoryCallTurn` / two-pass tool loop) is the strongest path for DB + actions, but **voice path historically bypassed** that utterance choice. |
| **Bounded / semi-agentic triage** | Tool requests as JSON fields + backend execution + max two passes—**must stay** explicit and safe as we unify runtime. |
| **Mocked tools** | Geocode, responder lookup, event zones, SMS draft are **mock/template/static**—fine for demos; polish replaces **geocode** with Mapbox MCP-backed path where feasible. |
| **No runtime Mapbox MCP** | MCP appears in docs/skills only—**no production broker** in app code yet. |
| **`caller_phone` null risk** | Operator SMS relies on latest session phone; **EL-only or partial paths** can leave **null** → SMS failures or opaque UX. |
| **Transfer disconnected** | **`POST /api/twilio/transfer`** exists server-side; ElevenLabs path had **hardcoded `shouldTransfer`** / no live bridge trigger—transfer story must reconnect behind gates. |
| **Dashboard hydration / realtime fallback** | Supabase anon + realtime vs **`GET /api/dev/incidents`** fallback vs static fallback—**subscription noop** scenarios can leave empty queue / loading until manual refresh (see dataflow doc). |
| **Client-derived clusters** | **`deriveSurgeClusters`** drives UI; **`repositorySurgeAnalyze` / `/api/surge/analyze`** alignment with persistence is incomplete—GeoOps not authoritative in UI. |
| **Weak AI provenance in operator UI** | **`triage_trace`** visible in dev simulator paths but **not** clearly in operator drawer—trust/debugging gaps. |

---

## 3. Branching and Collaboration Rules

**Branch model**

```txt
main
└── polish-integration          # staging / integration
    └── polish/full-agent-runtime-polish   # single long-running work branch (sequential contributors)
```

**Rules**

- **`main`** stays stable; polish merges land via **`polish-integration`** when ready.
- All sprint implementation work happens on **`polish/full-agent-runtime-polish`**.
- **One person works at a time** on that branch.
- **Always pull before starting** work.
- **Push after every commit** so the next person sees latest state.
- **Do not create a new branch per phase** unless the team explicitly decides to diverge.

**Start / sync**

```bash
git checkout polish/full-agent-runtime-polish
git pull origin polish/full-agent-runtime-polish
```

**After every substep**

```bash
git status
git diff --stat
git add .
git commit -m "phase XX.Y: <short description>"
git push
```

**After every full phase**

```bash
npm run build
npm run test:run
npm run lint
```

Then update and push the log:

```bash
git add docs/polish/phase_execution_log.md
git commit -m "docs: update phase XX execution log"
git push
```

---

## 4. Cursor / Codex Rules

Before **every phase**, read:

- `docs/polish/master_project_plan.md`
- `docs/polish/phase_execution_log.md`
- `docs/backend_architecture_current.md`
- `docs/triage_agent_current_runtime.md`
- `docs/frontend_backend_dataflow.md`
- `docs/codebase_implementation_audit.md`

While executing:

- Work **only** on the **next incomplete** phase in the execution log.
- **Do not** implement future phases early.
- **Do not** refactor unrelated files.
- **Stop after each substep** with a concise summary of changes.
- **Commit after each substep** (see §3).
- **Update `phase_execution_log.md` after every phase** with commands, results, blockers, hashes.
- If touching **shared** surfaces (`lib/types/*`, `lib/validation/*`, `package.json`, Supabase migrations, core `call-repository`), **document rationale** in the execution log.
- If a phase cannot finish cleanly, mark **Blocked** or **Needs Follow-up** and leave **exact handoff notes** (file paths, failing tests, env gaps).

---

## 5. Verification Rules

- Run **`npm run build`**, **`npm run test:run`**, and **`npm run lint`** after **every full phase** (and fix or document failures—**never hide** failing output).
- Record **command outcomes** in `docs/polish/phase_execution_log.md`.
- If **environment variables** are missing for a check, state which vars and whether the phase is **Verified** only under documented assumptions.
- **No phase is complete** until the execution log reflects status, results, and handoff.

---

## 6. Shared File Caution List

Expect merge churn / careful sequencing on:

- `app/api/elevenlabs/webhook/route.ts`
- `app/api/call/turn/route.ts`
- `lib/db/call-repository.ts`
- `lib/types/*`
- `lib/validation/*`
- `lib/ai/toolRegistry.ts`
- `lib/ai/executeAllowedToolRequests.ts`
- `lib/server/merge-triage-output.ts`
- `lib/server/transferGate.ts`
- `components/dashboard/DashboardShell.tsx`
- `components/voice/CallControlPanel.tsx`
- `components/voice/LiveTranscriptPanel.tsx`
- `components/map/CommandMap.tsx`
- `package.json`
- `supabase/migrations/*`

---

## 7. 21-Phase Master Plan

### Phase 1 — Create Polish Docs and Contracts

| Field | Content |
|-------|---------|
| **Goal** | Create docs structure and shared **outline** contracts for the polish sprint. |
| **Problem solved** | No single sprint SSOT; contributors lack sequencing and verification hooks. |
| **Expected scope** | This repo folder + appendix contract stubs in this file; execution log initialized. |
| **Expected output** | `docs/polish/master_project_plan.md`, `docs/polish/phase_execution_log.md`, **Appendix A** below. |
| **Verification requirement** | Docs exist, phases 1–21 listed, branching/commands consistent. |

### Phase 2 — Define Emergency Runtime Contracts

| Field | Content |
|-------|---------|
| **Goal** | Define runtime output shapes all later code converges on. |
| **Problem solved** | Implicit JSON shapes scattered across routes/repos—hard to unify EL + `/api/call/turn`. |
| **Expected scope** | Types / docs for: `EmergencyTurnResult`, `RuntimeAction`, `TriageTrace`, `ToolResult`, `TransferRecommendation`, `OperatorAssignmentResult`, `AgentTraceView`. |
| **Expected output** | Contracts documented clearly; optional mirrored TypeScript in `lib/types/*` **without** behavior change unless additive. |
| **Verification requirement** | No observable app behavior change unless new types are imported (then tests still pass). |

### Phase 3 — Create `runEmergencyTurn()` Runtime Wrapper

| Field | Content |
|-------|---------|
| **Goal** | Central wrapper becomes the shared spine for turns. |
| **Problem solved** | Duplicate orchestration entry points (routes vs EL). |
| **Expected scope** | Add `lib/runtime/runEmergencyTurn.ts`; initially **delegate** to `repositoryCallTurn`. |
| **Expected output** | Single exported function; **no behavior change**. |
| **Verification requirement** | Existing `/api/call/turn` tests and runtime unchanged if wrapper unused externally yet. |

### Phase 4 — Route `/api/call/turn` Through Runtime

| Field | Content |
|-------|---------|
| **Goal** | HTTP route calls `runEmergencyTurn()`. |
| **Problem solved** | Route bypasses future unified instrumentation/guards. |
| **Expected scope** | `app/api/call/turn/route.ts` + thin adapter glue only. |
| **Expected output** | Same JSON: incident, call_session, `say_to_caller`, actions, `triage_trace`. |
| **Verification requirement** | **`npm run test:run`** green; contract tests for call turn pass. |

### Phase 5 — Fix ElevenLabs Split-Brain Voice Path

| Field | Content |
|-------|---------|
| **Goal** | ElevenLabs speaks **validated** triage `say_to_caller`. |
| **Problem solved** | Caller hears ad-hoc prose vs DB transcript mismatch. |
| **Expected scope** | `app/api/elevenlabs/webhook/route.ts`, runtime wrapper, latency-aware voice assembly. |
| **Expected output** | `llm_turn` uses same triage decision path as backend/dashboard utterance. |
| **Verification requirement** | Live or sim call: spoken line aligns with stored `say_to_caller` / transcript policy (document scenario in log). |

### Phase 6 — Fix `caller_phone` Lifecycle for SMS

| Field | Content |
|-------|---------|
| **Goal** | Persist caller phone whenever telephony provides it. |
| **Problem solved** | SMS recipient lookup fails on **null** `caller_phone`. |
| **Expected scope** | Twilio inbound, EL session resolution, `call_sessions` persistence, operator SMS path. |
| **Expected output** | Reliable default recipient **or** explicit structured failure reason to UI/API. |
| **Verification requirement** | Latest session shows `caller_phone` after live/sim PSTN-consistent start. |

### Phase 7 — Wire Triage Transfer Recommendation

| Field | Content |
|-------|---------|
| **Goal** | Triage emits explicit transfer recommendation payload. |
| **Problem solved** | Transfer intent buried / inconsistent for UI + gates. |
| **Expected scope** | Schema + merge + persistence fields as needed; **gate** still authoritative. |
| **Expected output** | Critical scenarios populate `transfer_recommended`, `operator_required`, `reason` (names per finalized contracts). |
| **Verification requirement** | No auto-transfer unless **`transferGate`** (or successor) approves—prove with tests/fixtures. |

### Phase 8 — Scaffold Mapbox MCP Broker and Tool Layer

| Field | Content |
|-------|---------|
| **Goal** | Backend-safe MCP/tool structure. |
| **Problem solved** | No runtime MCP integration. |
| **Expected scope** | `lib/mcp/*`, `lib/tools/mapbox/*`, tool contracts, env/config stubs. |
| **Expected output** | Broker shape + registration points; safe noop/fallback when MCP off. |
| **Verification requirement** | Existing mock triage tools **still execute**; no regressions in default demo path. |

### Phase 9 — Implement Mapbox MCP Geocode / Search Tool

| Field | Content |
|-------|---------|
| **Goal** | Real MCP-backed geocode/search backend tool. |
| **Problem solved** | Geocode is pure mock jitter today. |
| **Expected scope** | MCP client call + timeouts + error taxonomy. |
| **Expected output** | Tool returns coordinates/string with **source + status** fields. |
| **Verification requirement** | Integration or unit test with mocked MCP HTTP; document env vars in log. |

### Phase 10 — Replace Mock `geocode_location`

| Field | Content |
|-------|---------|
| **Goal** | Executor routes triage geocode through MCP-backed path with fallback. |
| **Problem solved** | Map pins disconnected from real grounding. |
| **Expected scope** | `executeAllowedToolRequests` / registry wiring for geocode tool. |
| **Expected output** | Triage `geocode_location` yields Mapbox-backed results when configured. |
| **Verification requirement** | Demo/sim updates **`Incident.coordinates`** from tool output (record before/after in log). |

### Phase 11 — Add Tool Result Provenance

| Field | Content |
|-------|---------|
| **Goal** | Every tool invocation is auditable. |
| **Problem solved** | Operators/engineers cannot see tool latency/errors cleanly in trace. |
| **Expected scope** | Normalize tool result record: name, input, output, status, source, latency, error. |
| **Expected output** | **`triage_trace`** (or successor) embeds provenance array/links to audit. |
| **Verification requirement** | Tests assert provenance fields present on successful + failed tool calls. |

### Phase 12 — Build Operator Assignment Engine

| Field | Content |
|-------|---------|
| **Goal** | Deterministic assignment recommendations for free operators. |
| **Problem solved** | Operator routing is env-toggle/manual—not incident-queue-aware. |
| **Expected scope** | Pure function/module; **no preemption** rule; priority ordering spec’d in tests. |
| **Expected output** | Given fixtures: **one free operator → highest-priority waiting incident**. |
| **Verification requirement** | Unit test or dev fixture proves deterministic behavior. |

### Phase 13 — Connect Transfer Recommendation to Assignment Logic

| Field | Content |
|-------|---------|
| **Goal** | Transfer recommendation feeds assignment/preparation flow. |
| **Problem solved** | Transfer and assignment stories disconnected. |
| **Expected scope** | Wire outputs from Phase 7 + 12 into runtime result (may be recommendation-only). |
| **Expected output** | Runtime exposes whether operator available / intake should continue—visible in logs or typed result. |
| **Verification requirement** | Document matrix: operator free vs busy × transfer recommended (log + optional test). |

### Phase 14 — Fix Backend GeoOps Route and Persistence

| Field | Content |
|-------|---------|
| **Goal** | Backend GeoOps authoritative data path. |
| **Problem solved** | `/api/surge/analyze` vs `repositorySurgeAnalyze` mismatch; `cluster_id` underused. |
| **Expected scope** | Route + repo alignment; persist `cluster_id` / priorities where schema allows. |
| **Expected output** | HTTP API triggers persistence used by dashboard adapters later. |
| **Verification requirement** | After analyze call, incidents reflect backend cluster assignment in DB or demo-store (assert in test or manual script). |

### Phase 15 — Fix Dashboard Initial Hydration / Fallback

| Field | Content |
|-------|---------|
| **Goal** | No infinite loading / empty queue when browser Supabase env missing. |
| **Problem solved** | Subscription noop + skipped initial fetch edge case (see dataflow doc). |
| **Expected scope** | `DashboardShell` + incident datasource interaction only. |
| **Expected output** | Incidents load via Supabase **or** API fallback **or** explicit empty state with banner. |
| **Verification requirement** | Manual matrix: (anon env set | unset) × refresh behavior—document in log. |

### Phase 16 — Add AI Trace Panel

| Field | Content |
|-------|---------|
| **Goal** | Operator drawer shows agent/provider/tool summary. |
| **Problem solved** | **`triage_trace`** invisible in main operator UX. |
| **Expected scope** | `IncidentDrawer` or sub-component; read-only from latest turn/audit. |
| **Expected output** | Shows provider, fallback status, tools used, validation summary, latest `say_to_caller`, transfer recommendation. |
| **Verification requirement** | Featherless vs Gemma vs mock visibly distinguishable in UI checklist. |

### Phase 17 — Add Tool / Action Timeline

| Field | Content |
|-------|---------|
| **Goal** | Visual lifecycle from call start through SMS/transfer. |
| **Problem solved** | Operators infer order from raw transcript only. |
| **Expected scope** | Compose from `audit_logs`, `transcript_events`, trace segments—fallback gracefully when data missing. |
| **Expected output** | Ordered timeline component with key milestones. |
| **Verification requirement** | Demo script lists expected milestones all visible for one incident. |

### Phase 18 — Improve SMS and Transfer UI States

| Field | Content |
|-------|---------|
| **Goal** | Operator clarity on SMS + transfer. |
| **Problem solved** | Opaque stub/error states in `CallControlPanel`. |
| **Expected scope** | Phone display, recipient override UX (if allowed), transfer recommendation + optional manual transfer trigger behind auth/gates. |
| **Expected output** | Clear sent/stub/error; transfer status aligned with server where possible. |
| **Verification requirement** | Manual checklist: null phone, stub Twilio, success path. |

### Phase 19 — Show Backend GeoOps Cluster Source

| Field | Content |
|-------|---------|
| **Goal** | UI labels cluster derivation source. |
| **Problem solved** | Client clusters masquerade as authoritative GeoOps. |
| **Expected scope** | `ClusterDrawer` / map chrome; consume persisted `cluster_id` / API metadata when present. |
| **Expected output** | Badge: backend GeoOps vs client fallback. |
| **Verification requirement** | Two incidents: one with persisted cluster, one without—labels differ. |

### Phase 20 — Add Multilingual Demo Visibility

| Field | Content |
|-------|---------|
| **Goal** | Dashboard reflects multilingual pipeline outputs. |
| **Problem solved** | Translation/language fields exist but demo narrative unclear. |
| **Expected scope** | Drawer/transcript areas; wiring to `language`, `translated_text`, summaries as available. |
| **Expected output** | Single multilingual demo scenario describable in one screenshot/story. |
| **Verification requirement** | Document scenario + env (`IBM_TRANSLATION_*` etc.) in demo script. |

### Phase 21 — Final Hardening, Tests, and Demo Script

| Field | Content |
|-------|---------|
| **Goal** | Freeze scope; verify; ship demo narrative. |
| **Problem solved** | Drift between “works on my machine” and reproducible sponsor demo. |
| **Expected scope** | Docs only + minimal bugfixes allowed by team; full build/test/lint recorded. |
| **Expected output** | `docs/polish/final_demo_script.md`, `docs/polish/final_verification_checklist.md`, execution log **Verified** stamps. |
| **Verification requirement** | One end-to-end demo path executed twice by different readers following script without blockers. |

---

## Appendix A — Initial Contract Sections (Phase 1 Draft)

*Phase 2 refines names, fields, and TypeScript mirrors. This appendix is intentionally sketch-level.*

### A.1 `EmergencyTurnResult`

- **Purpose:** Single return shape from `runEmergencyTurn` consumed by HTTP adapters ( `/api/call/turn`, ElevenLabs bridge ).
- **Includes:** identifiers (`incident_id`, `call_session_id`), normalized **`say_to_caller`**, **`actions`**, **`triage_trace`**, optional **`transfer_recommendation`**, optional **`operator_assignment`**, **`validation_warnings`**.
- **Non-goals:** Raw LLM strings beyond validated assistant payload.

### A.2 `RuntimeAction`

- **Purpose:** Serializable operator/agent directives produced by triage merge (e.g., escalate, SMS draft approval flags)—exact union TBD in Phase 2.
- **Rule:** Must be schema-validated before execution side-effects.

### A.3 `TriageTrace`

- **Purpose:** Bounded trace of passes, providers, tool requests/results summaries, validation outcomes.
- **Align with:** existing `CallTurnResponse.triage_trace` patterns in `lib/types/api.ts` where possible.

### A.4 `ToolResult`

- **Purpose:** Normalized tool execution envelope (name, input hash/redacted input, output, status, source=`mock|mcp|http`, latency_ms, error).

### A.5 `TransferRecommendation`

- **Purpose:** `recommended: boolean`, `reason`, `urgency_threshold_met`, **opaque gate token / correlation id** for `transferGate`.

### A.6 `OperatorAssignmentResult`

- **Purpose:** Recommended `operator_id` or null, ranking rationale code (enum), **no preemption** flag enforced.

### A.7 `AgentTraceView`

- **Purpose:** Dashboard-facing DTO (subset/redaction of `TriageTrace` + timeline anchors) for Phase 16–17 UI.

---

*End of master plan.*
