# ECC Polish Sprint — Final Verification Checklist

Use this checklist before declaring the polish sprint **demo-ready**. Pair it with [final_demo_script.md](./final_demo_script.md).

**PowerShell note:** If `npm run …` fails with an execution-policy error on `npm.ps1`, use **`npm.cmd run …`** instead and record that in [phase_execution_log.md](./phase_execution_log.md).

---

## Branch and repository status

- [ ] On branch `polish/full-agent-runtime-polish` (or documented integration branch if team agreed otherwise).
- [ ] `git pull` completed; working tree matches what you intend to demo.
- [ ] `git status` clean **or** any dirty files documented (should be none for freeze).

---

## Environment variables (grouped)

Check only what applies to your demo path. Values are **never** committed; use local `.env.local` or host secrets.

### Supabase / persistence

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server URL; required with keys below. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` **or** `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard anon reads + realtime (`lib/supabase/env.ts`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server writes via `getServiceRoleClient()` (`lib/supabase/service.ts`). If missing with URL also partial, persistence falls back — see **Known fallback behavior**. |

- [ ] **Dashboard realtime path**: URL + publishable/anon key present in the **browser** env.
- [ ] **Durable multi-user demo**: URL + **service role** key present on the **server**.

### Twilio / SMS / transfer (live telephony)

See `lib/voice/voiceConfig.ts`.

| Variable | Role |
|----------|------|
| `TWILIO_ACCOUNT_SID` | REST + PSTN |
| `TWILIO_AUTH_TOKEN` | REST |
| `TWILIO_PHONE_NUMBER` | Inbound number |
| `TWILIO_OPERATOR_FORWARD_NUMBER` | Transfer target (primary) |
| `TWILIO_OPERATOR_FORWARD_NUMBER_ALT` | Optional alternate queue for disaster/world_cup |

- [ ] Twilio **fully** configured — live SMS and transfer REST behave per Twilio docs.
- [ ] Twilio **unset** — expect **SMS stub** and transfer limitations; demo script should say “stub mode.”

### ElevenLabs

| Variable | Role |
|----------|------|
| `ELEVENLABS_API_KEY` | Agent API |
| `ELEVENLABS_AGENT_ID` | Conversational AI agent |
| `ELEVENLABS_WEBHOOK_SECRET` | When empty, webhook signature verification is effectively skipped — document for production risk. |

- [ ] EL agent points at this deployment’s webhook URLs as configured by the team.

### Triage LLM providers

| Variable | Role |
|----------|------|
| `AI_PROVIDER` | e.g. `featherless`, `gemma`, `mock` (see `runCallTriageAgent` behavior). |
| `FEATHERLESS_API_KEY`, `FEATHERLESS_MODEL`, optional `FEATHERLESS_BASE_URL`, etc. | Featherless OpenAI-compatible triage (`lib/ai/providers/featherlessClient.ts`). |
| `GEMMA_API_KEY`, optional `GEMMA_MODEL` | Google Gemma triage (`lib/ai/providers/gemmaClient.ts`). |

- [ ] Provider keys match **`AI_PROVIDER`** choice or expect deterministic **mock** triage fallback.

### Map — dashboard (browser)

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL map (`CommandMap`). |

- [ ] Token present for map demo **or** accept offline/map-disabled UX.

### Mapbox MCP — backend geocode tool

See `lib/tools/mapbox/mapboxToolConfig.ts`.

| Variable | Role |
|----------|------|
| `MAPBOX_MCP_ENABLED` | Must be **`true`** to attempt MCP calls. |
| `MAPBOX_ACCESS_TOKEN` | Bearer token for MCP endpoint (required when enabled). |
| `MAPBOX_MCP_URL` | Optional; defaults to hosted MCP URL in config. |
| `MAPBOX_MCP_TIMEOUT_MS` | Optional timeout override. |

- [ ] **MCP on**: enabled + token set → geocode tool can return MCP-backed coordinates.
- [ ] **MCP off / missing token**: expect **`geocodeLocation`** fallback (mock/static/deterministic) — still valid demo path.

### IBM / watsonx (optional translation)

See `lib/voice/transcriptTranslation.ts`, `lib/voice/ibmLanguageTranslator.ts`.

| Variable | Role |
|----------|------|
| `IBM_TRANSLATION_ENABLED` | Must be **`true`** or translation layer stays off. |
| `IBM_WATSONX_API_KEY`, `IBM_WATSONX_PROJECT_ID`, optional URL/model | IBM client |

- [ ] Do **not** claim watsonx in the demo unless `IBM_TRANSLATION_ENABLED=true` and keys work.

### Advisory operator assignment (runtime)

See `lib/server/operatorAvailability.ts`.

| Variable | Role |
|----------|------|
| `OPERATOR_AVAILABILITY` | `free` (default) or `busy` — affects transfer gating / advisory narrative. |
| `OPERATOR_ASSIGNMENT_SOURCE` | Set to `unavailable` to exercise **`operator_assignment: null`** + validation warning paths in tests/demo. |

---

## Automated verification

Run from repo root after `npm install`:

```bash
npm.cmd run build
npm.cmd run test:run
npm.cmd run lint
```

*(Use `npm run` instead of `npm.cmd run` when PowerShell allows.)*

**Latest recorded Phase 21 run** — copy from [phase_execution_log.md](./phase_execution_log.md) Phase 21 → **Commands Run** after verification:

| Command | Result |
|---------|--------|
| `npm.cmd run build` | passed (Next.js production build succeeded; Turbopack lockfile root warning; middleware deprecation notice) |
| `npm.cmd run test:run` | passed — **165 tests**, **24** test files |
| `npm.cmd run lint` | passed — **0 errors**, **6** pre-existing warnings (`app/api/twilio/dial-result/route.ts`, `components/map/CommandMap.tsx`, `lib/ai/toolResults.ts`) |

- [ ] Build passed.
- [ ] Tests passed.
- [ ] Lint: **0 errors** (warnings documented if pre-existing).

---

## Manual dashboard checks

- [ ] Dashboard loads incidents without indefinite **loading** (Phase 15 hydration): with or without browser Supabase env.
- [ ] **Refresh** still works from the top bar.
- [ ] Selecting incidents opens **IncidentDrawer** with tabs **Triage**, **Operator**, **Details**, **Live voice**.
- [ ] **Triage**: timeline + multilingual trace + AI trace render; empty states explicit when data missing.
- [ ] **Operator**: SMS / transfer status strings match expectations (recipient missing vs ready; no fake “transferred” unless session says so).
- [ ] **Live voice**: transcript list; language / translation labels behave per Phase 20.
- [ ] Map shows incidents when coordinates exist; cluster selection opens **ClusterDrawer** with source badge.

---

## Manual call / triage checks

Pick **one** path appropriate to your env:

- [ ] **HTTP**: `POST /api/call/start` then `POST /api/call/turn` with valid bodies (see `lib/validation/api-requests.ts`) — response includes **`say_to_caller`**, **`incident`**, **`call_session`**, **`triage_trace`** as applicable.
- [ ] **Live PSTN**: inbound Twilio → session appears in dashboard (when persistence + data sources aligned).
- [ ] **Dev preview**: `POST /api/dev/triage-preview` — **dry-run** triage JSON **without** full repository tool loop; label honestly if you use this only as a smoke test.

---

## Manual SMS checks

- [ ] With Twilio configured: operator SMS succeeds for an incident with **`caller_phone`** (or explicit recipient per API).
- [ ] Without Twilio: UI shows **stub / not sent / provider unavailable** style messaging — no silent success.
- [ ] Missing **`caller_phone`**: UI shows **missing recipient** (Phase 18 helpers).

---

## Manual Mapbox / geocode checks

- [ ] With **`MAPBOX_MCP_ENABLED=true`** and token: trigger triage **`geocode_location`** (final turn that requests geocode) and confirm coordinates/tool provenance move off pure mock when MCP succeeds.
- [ ] With MCP disabled: confirm incidents still receive **fallback** coordinates / pins (deterministic mock path) — demo remains coherent.

---

## Manual GeoOps / cluster source checks

- [ ] Incidents **with** persisted **`cluster_id`** from backend GeoOps flows group as **`Backend GeoOps`** in cluster UI when derived clustering marks `source: "backend_geoops"` (Phase 19).
- [ ] Purely grid/coordinate-derived groups show **`Client fallback`** with explanatory copy.
- [ ] **`priority_score`** visible in cluster drawer when present on backend-backed clusters.

---

## Manual multilingual visibility checks

- [ ] **MultilingualTracePanel** lists caller language / translation status when **`TranscriptEvent.language`**, **`translated_text`**, or **`collected_fields.caller_language`** exist.
- [ ] When absent: copy states multilingual details are **not available yet** (no fabricated IBM/watsonx).

---

## Known fallback behavior (document honestly)

- [ ] **No service-role Supabase**: in-process **`demo-store`** — not durable across instances/restarts (`lib/server/demo-store.ts`).
- [ ] **No browser Supabase keys**: realtime subscription no-op; Phase 15 ensures **initial fetch** still runs via API/static paths — confirm for your env.
- [ ] **Twilio unset**: SMS + transfer REST stubs (`lib/voice/smsClient.ts`, transfer route behavior).
- [ ] **Transfer**: advisory recommendation and UI states ≠ **Safe Transfer Execution** (see backlog).

---

## Post–Phase 21 backlog

Minimum backlog items for roadmap / sponsors:

### Safe Transfer Execution

- [ ] Validate transfer recommendation server-side before any bridge.
- [ ] Validate assigned/free operator **or** configured service number before redirect.
- [ ] Call existing Twilio transfer/bridge helper from a **controlled** server path.
- [ ] Update **`call_session`** transfer status consistently.
- [ ] Audit transfer attempts/results.
- [ ] Prevent duplicate transfer attempts.
- [ ] **Never** let the LLM directly transfer calls — only validated backend actions.

### Platform / product follow-through

- [ ] Real operator roster + persistence (beyond advisory env toggles).
- [ ] Full **`agent_runs` / `tool_results`** tables persisted for replay and ops.
- [ ] Agent **replay** mode for incidents.
- [ ] Triage **evaluation harness** (offline scoring/regression).
- [ ] Real responder DB + ETA routing (replace mock responders).
- [ ] Auth / RBAC / security hardening (close dev-only surfaces; enforce webhook signatures).
- [ ] Production monitoring (metrics, tracing, alerting).

### Documentation hygiene (optional)

- [ ] Reconcile `docs/backend_architecture_current.md` / `docs/frontend_backend_dataflow.md` with post-polish EL + clustering behavior where they still describe pre-polish gaps.

---

## Dual-reader verification (master plan Phase 21)

[master_project_plan.md](./master_project_plan.md) expects **two independent readers** to execute one end-to-end path from [final_demo_script.md](./final_demo_script.md) **without blockers**.

- [ ] Reader A completed **Section 3** main flow — date: _______________
- [ ] Reader B completed **Section 3** main flow — date: _______________

When both are done, record **Verified** criterion satisfaction in [phase_execution_log.md](./phase_execution_log.md) Phase 21.
