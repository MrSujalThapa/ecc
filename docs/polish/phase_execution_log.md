# ECC Polish Phase Execution Log

Sequential work on branch **`polish/full-agent-runtime-polish`** only (unless team explicitly branches). One contributor at a time.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| **Not Started** | No work begun. |
| **In Progress** | Active contributor owns this phase. |
| **Blocked** | External dependency or decision prevents completion—see handoff notes. |
| **Completed** | Scope merged locally and pushed; may still await verification stamps. |
| **Needs Follow-up** | Merged with known gaps—document what remains. |
| **Verified** | Phase scope + verification requirement satisfied and recorded below. |

---

## How To Use This Log

1. **Pull** latest: `git checkout polish/full-agent-runtime-polish` then `git pull origin polish/full-agent-runtime-polish`.
2. Find the **first phase** not marked **Completed** / **Verified**.
3. Set **Status** to **In Progress**, set **Owner**, set **Started** timestamp.
4. Complete **substeps**; after **each substep**: commit + push per `docs/polish/master_project_plan.md` §3.
5. After the **full phase**: run `npm run build`, `npm run test:run`, `npm run lint`; paste summarized results under **Commands Run**.
6. Update this file: **Result**, **Issues / Blockers**, **Commit Hashes**, **Handoff Notes**, **Required Changes for Next Phase**.
7. Set **Status** to **Completed** or **Verified** (or **Blocked** / **Needs Follow-up**).
8. Commit log only: `git add docs/polish/phase_execution_log.md && git commit -m "docs: update phase XX execution log" && git push`.
9. If something is broken, **document honestly**—do not mark **Verified** until true.

---

## Phase 1 — Create Polish Docs and Contracts

**Status:** Completed  
**Owner:** Sujal / current contributor  
**Branch:** `polish/full-agent-runtime-polish`  
**Started:** 2026-05-12  
**Completed:** 2026-05-12

### Goal

Create the docs structure and shared contracts outline for the polish sprint (`docs/polish/*`, Appendix A in master plan).

### Substeps Completed

- [x] Created `docs/polish/master_project_plan.md`
- [x] Created `docs/polish/phase_execution_log.md`
- [x] Added the 21-phase ECC Agent Runtime Polish Master Plan
- [x] Added branching/collaboration rules for `main`, `polish-integration`, and `polish/full-agent-runtime-polish`
- [x] Added Cursor/Codex rules
- [x] Added verification rules
- [x] Added shared-file caution list
- [x] Added initial contract outlines (Appendix A) in the master plan
- [x] Added execution-log templates for all 21 phases
- [x] Created `docs/polish/cursor_phase_prompts.md` (ready-to-paste Cursor prompts for future contributors)

### Files Changed

- `docs/polish/master_project_plan.md` (new)
- `docs/polish/phase_execution_log.md` (new)
- `docs/polish/cursor_phase_prompts.md` (new)

### Commands Run

```bash
git status
git diff --stat
```

Output (post-commit sanity check on contributor machine):

```
On branch polish/full-agent-runtime-polish
Your branch is up to date with 'origin/polish/full-agent-runtime-polish'.

nothing to commit, working tree clean
```

(`git diff --stat` produced no output — clean tree.)

**Note:** Phase 1 verification is documentation-only per `docs/polish/master_project_plan.md` (§7 Phase 1). Full `npm run build` / `npm run test:run` / `npm run lint` cycle applies starting after substantive implementation phases; run before marking later phases **Verified**.

### Result

Created the master plan, execution log, and Cursor prompt guide. Future contributors can now follow the execution log, read the master plan, and copy the next phase prompt from `docs/polish/cursor_phase_prompts.md`.

### Issues / Blockers

None.

### Required Changes for Next Phase

None. Phase 2 can begin.

### Commit Hashes

- `fd3db50` — `phase 1.1: add polish sprint docs` (initial `docs/polish/*` scaffold)
- _(add hash after commit)_ — `docs: update phase 1 execution log` (mark Phase 1 **Completed**)

### Handoff Notes

Next contributor should start Phase 2 using the Phase 2 Ready-to-Paste Prompt in `docs/polish/cursor_phase_prompts.md`.

---

## Phase 2 — Define Emergency Runtime Contracts

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Define the shape of runtime outputs (`EmergencyTurnResult`, `RuntimeAction`, `TriageTrace`, `ToolResult`, `TransferRecommendation`, `OperatorAssignmentResult`, `AgentTraceView`) for later implementation.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 3 — Create runEmergencyTurn() Runtime Wrapper

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Add `lib/runtime/runEmergencyTurn.ts` as a central wrapper initially delegating to `repositoryCallTurn`, without behavior change.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 4 — Route /api/call/turn Through Runtime

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Make `POST /api/call/turn` invoke `runEmergencyTurn()` while preserving response shape (incident, call_session, `say_to_caller`, actions, `triage_trace`).

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 5 — Fix ElevenLabs Split-Brain Voice Path

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Make ElevenLabs `llm_turn` speak validated triage `say_to_caller` using the same decision path as structured backend triage.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 6 — Fix caller_phone Lifecycle for SMS

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Ensure live calls persist `caller_phone` when available so SMS default recipient lookup is reliable or fails with a clear reason.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 7 — Wire Triage Transfer Recommendation

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Emit clean transfer recommendation fields from triage (`transfer_recommended`, `operator_required`, reason) gated—no unsafe auto-transfer without backend approval.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 8 — Scaffold Mapbox MCP Broker and Tool Layer

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Create backend-safe MCP/tool structure under `lib/mcp/*` and `lib/tools/mapbox/*` without breaking existing mock tool paths.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 9 — Implement Mapbox MCP Geocode/Search Tool

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Backend tool invokes Mapbox MCP (or explicit fallback) for geocode/search; results include source and status.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 10 — Replace Mock geocode_location

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Route triage `geocode_location` through MCP-backed geocoding with fallback; map pins reflect tool-derived coordinates when successful.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 11 — Add Tool Result Provenance

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Every tool call records auditable provenance (name, input, output, status, source, latency, error); trace reflects it.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 12 — Build Operator Assignment Engine

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Deterministic assignment recommendations: no preemption, free operator selection, priority ordering—unit-tested.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 13 — Connect Transfer Recommendation to Assignment Logic

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Connect triage transfer recommendation to assignment logic; behavior visible in runtime result or structured logs.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 14 — Fix Backend GeoOps Route and Persistence

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Align `/api/surge/analyze` with `repositorySurgeAnalyze`; persist `cluster_id` / priority outputs where feasible.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 15 — Fix Dashboard Initial Hydration/Fallback

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Dashboard loads incidents without hanging when browser Supabase env is missing; clear status for realtime vs API vs fallback.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 16 — Add AI Trace Panel

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Incident drawer shows provider, fallback status, tools used, validation summary, latest `say_to_caller`, transfer recommendation.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 17 — Add Tool/Action Timeline

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Visual timeline for incident lifecycle (start, transcript, triage, tools, location, transfer, assignment, SMS).

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 18 — Improve SMS and Transfer UI States

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Operator UI shows caller phone, SMS recipient, sent/stub/error state, transfer recommendation/status, optional manual transfer.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 19 — Show Backend GeoOps Cluster Source

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Cluster drawer/map indicates backend GeoOps vs client-derived fallback clusters.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 20 — Add Multilingual Demo Visibility

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Dashboard/demo surfaces caller language, original transcript, English summary/transcript, AI reply language where data exists.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

## Phase 21 — Final Hardening, Tests, and Demo Script

**Status:** Not Started  
**Owner:** Unassigned  
**Branch:** polish/full-agent-runtime-polish  
**Started:**  
**Completed:**

### Goal

Produce `docs/polish/final_demo_script.md`, `docs/polish/final_verification_checklist.md`, record final build/test/lint; freeze demo-ready behavior.

### Substeps Completed

- [ ]
- [ ]

### Files Changed

### Commands Run

```bash
# Add commands and results here
```

### Result

Not started.

### Issues / Blockers

None yet.

### Required Changes for Next Phase

None yet.

### Commit Hashes

### Handoff Notes

None yet.

---

*End of execution log template.*
