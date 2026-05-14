# Cursor Phase Prompts

Ready-to-paste prompts for the ECC polish sprint. Canonical phase definitions live in `docs/polish/master_project_plan.md` §7.

---

## How To Use

Before starting work:

```bash
git checkout polish/full-agent-runtime-polish
git pull origin polish/full-agent-runtime-polish
```

Open:

- `docs/polish/phase_execution_log.md`

Start the **first phase** that is not **Completed** or **Verified**.

After every substep:

```bash
git status
git diff --stat
git add .
git commit -m "phase XX.Y: <short description>"
git push
```

After every full phase:

```bash
npm run build
npm run test:run
npm run lint
```

Then update:

- `docs/polish/phase_execution_log.md`

Commit the log:

```bash
git add docs/polish/phase_execution_log.md
git commit -m "docs: update phase XX execution log"
git push
```

---

## Universal Cursor Prompt Template

Copy this block, replace `XX`, `<phase title>`, and the three quoted sections with the **Goal**, **Expected output**, and **Verification requirement** rows from `docs/polish/master_project_plan.md` §7 for that phase.

```
You are working on the ECC polish sprint.

Current phase:
Phase XX — <phase title>

Read first:
- docs/polish/master_project_plan.md
- docs/polish/phase_execution_log.md
- docs/codebase_implementation_audit.md
- docs/backend_architecture_current.md
- docs/triage_agent_current_runtime.md
- docs/frontend_backend_dataflow.md

Rules:
- Work only on Phase XX.
- Do not implement future phases.
- Do not refactor unrelated code.
- Keep changes scoped.
- Stop after each substep and summarize what changed.
- Commit after each substep.
- Update docs/polish/phase_execution_log.md at the end of the phase.
- If build/test/lint fail, document the failure honestly.

Phase goal:
<copy from master plan §7 — Goal>

Expected output:
<copy from master plan §7 — Expected output>

Verification:
<copy from master plan §7 — Verification requirement>

Start by inspecting the relevant files and proposing a short implementation plan. Do not edit files until the plan is clear.
```

---

## Phase 2 — Ready-to-paste prompt

```
You are working on the ECC polish sprint.

Current phase:
Phase 2 — Define Emergency Runtime Contracts

Read first:
- docs/polish/master_project_plan.md
- docs/polish/phase_execution_log.md
- docs/codebase_implementation_audit.md
- docs/backend_architecture_current.md
- docs/triage_agent_current_runtime.md
- docs/frontend_backend_dataflow.md

Rules:
- Work only on Phase 2.
- Do not implement Phase 3 or later.
- Do not change runtime behavior.
- Do not touch ElevenLabs routing, Mapbox MCP, transfer logic, GeoOps, dashboard UI, or SMS behavior.
- Inspect existing types before adding new ones.
- Prefer documentation-first unless TypeScript contracts naturally fit existing `lib/types/*`.
- If you modify shared files, explain why before editing.
- Stop after each substep and summarize exactly what changed.
- Update docs/polish/phase_execution_log.md when Phase 2 is complete.

Goal:
Define runtime output shapes all later code converges on.

Contracts to define:
- EmergencyTurnResult
- RuntimeAction
- TriageTrace
- ToolResult
- TransferRecommendation
- OperatorAssignmentResult
- AgentTraceView

Expected output:
Contracts documented clearly; optional mirrored TypeScript in lib/types/* without behavior change unless additive.

Verification:
No observable app behavior change unless new types are imported (then tests still pass). If only markdown is changed, record in the execution log that build/test/lint were skipped because the phase was docs-only.

Start by inspecting the relevant docs and existing lib/types/* files. Then propose a short Phase 2 implementation plan before editing.
```

---

## Adding prompts for Phases 3–21

Use the **Universal Cursor Prompt Template** above and fill in Goal / Expected output / Verification from `docs/polish/master_project_plan.md` §7 (each phase table). Add phase-specific **Rules** bullets when a phase touches risky surfaces listed in the master plan §6 (shared file caution list).
