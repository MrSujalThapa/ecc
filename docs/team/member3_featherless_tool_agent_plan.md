# Member 3 Addendum — Featherless Tool Agent Plan

## Purpose

This file is an addendum to:

```text
docs/team/member3_ai_agent_pipeline.md
```

It explains how Member 3 should upgrade the AI pipeline from basic triage output to a **Featherless-powered, controlled, tool-using agent system**.

This file does not replace the current Member 3 plan. It extends it.

---

## Member 3 Role In The Upgrade

Member 3 owns the reasoning layer.

Member 3 builds:

```text
- Featherless provider wrapper
- controlled agent runtime
- Call Triage Agent v2
- Surge / GeoOps Agent
- tool request schema
- tool result reasoning pass
- multilingual handling
- SMS draft output
- RAG-lite context usage
- fallback behavior
```

Member 3 does **not** directly execute tools or mutate system state.

```text
AI requests tools.
Backend executes tools.
AI reasons over tool results.
Backend validates final output.
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
docs/featherless_old_vs_new_architecture.md
docs/team/member3_ai_agent_pipeline.md
docs/team/member3_featherless_tool_agent_plan.md
```

---

## Existing Current State

Current provider plan:

```text
mock        = fallback/testing provider
gemma       = current real AI provider for testing/demo
featherless = future provider when subscription/API access is ready
```

Current output shape:

```text
tool_requests
incident_patch
call_session_patch
system_actions
say_to_caller
```

This remains useful and should not be broken.

---

## New Target State

New agent flow:

```text
Incident + CallSession + Transcript + ContextPack
→ Featherless first pass
→ ToolRequest[]
→ backend executes safe tools
→ ToolResult[]
→ Featherless second pass
→ final validated output
→ backend merges safe patches
```

The backend call site should still use a reusable function:

```ts
runCallTriageAgent({
  incident,
  callSession,
  latestTranscript,
  transcriptHistory,
  mode,
  provider,
  context,
  toolResults,
});
```

---

## Featherless Provider

Create or complete:

```text
/lib/ai/providers/featherlessClient.ts
```

The Featherless provider should use an OpenAI-compatible client pattern.

Requirements:

```text
- reads FEATHERLESS_API_KEY from env
- reads FEATHERLESS_MODEL from env
- uses JSON response format where possible
- has timeout handling
- falls back to mock on failure if configured
- never runs on frontend/client
```

---

## Controlled Agent Runtime

Create or complete:

```text
/lib/ai/agents/runControlledAgent.ts
```

Responsibilities:

```text
- build messages
- call selected provider
- parse JSON
- validate schema
- handle timeouts/errors
- optionally perform two-pass tool reasoning
- return safe fallback when invalid
```

The controlled runtime should limit:

```text
- number of tool-request rounds
- model retries
- token/context size
- unsafe outputs
```

---

## Call Triage Agent v2

The Call Triage Agent should support all modes:

```text
normal
disaster
world_cup
```

Responsibilities:

```text
- classify urgency
- classify incident type
- detect language
- summarize incident
- identify missing fields
- decide AI continue vs operator escalation
- request safe tools
- produce caller-safe response
- draft SMS if appropriate
```

---

## Tool Requests

The agent may request tools, but must not execute them.

Allowed tools should match `docs/api_contracts_agentic_proposal.md`.

Examples:

```text
geocode_location
reverse_geocode
event_zone_lookup
nearest_help_point_lookup
responder_lookup
route_between_points
travel_time_matrix
context_lookup
sms_draft
```

The prompt should clearly say:

```text
Return tool_requests when you need external geospatial/context information.
Do not invent tool results.
Do not assume a tool succeeded.
Wait for backend ToolResult before using the result.
```

---

## Tool Result Reasoning Pass

After Member 1 executes tool requests, the agent may receive ToolResult[].

The second pass should:

```text
- read tool results
- update final incident_patch
- update call_session_patch
- produce caller response
- produce operator recommendation
- include map recommendation
- include SMS draft state if needed
```

If tool results fail:

```text
- continue with safe fallback
- ask caller for clarification if needed
- avoid pretending route/help-point information is known
```

---

## Multilingual Handling

All modes should support multilingual callers.

Minimum fields:

```text
detected_language
translated_to_english
caller_response_language
```

Behavior:

```text
- summarize in English for operators
- preserve original transcript where available
- respond in caller's language when feasible
- keep caller response short and safe
```

---

## SMS Draft Behavior

The AI may draft SMS content, but backend/operator decides whether it is sent.

SMS draft should be:

```text
- factual
- short
- non-alarming
- language-aware
- based only on confirmed or clearly stated information
```

Do not promise emergency response timing or make guarantees.

---

## RAG-Lite Context

Do not build a complex vector database first.

The agent should accept a context pack from backend:

```text
event zones
help points
blocked roads
responders
SOP snippets
SMS templates
mode-specific notes
```

The agent should use provided context instead of inventing venue/resource details.

---

## Surge / GeoOps Agent

Create later after Call Triage Agent v2 is stable.

Suggested function:

```ts
runSurgeGeoOpsAgent({
  mode,
  activeIncidents,
  responders,
  eventLayers,
  recentToolResults,
  provider,
});
```

Responsibilities:

```text
- cluster related incidents
- rank incidents by priority
- summarize hotspots
- recommend operator focus
- recommend route/resource/help-point actions
- output structured SurgeGeoOpsAgentOutput
```

Do not perform actual dispatch. Recommend only.

---

## Phased Roadmap

## Phase M3-A — Featherless Provider Wrapper

Build:

```text
/lib/ai/providers/featherlessClient.ts
```

Requirements:

```text
- OpenAI-compatible client pattern
- env validation
- JSON output
- timeout/error handling
- mock fallback
```

## Phase M3-B — Agent Output v2 Schema

Build or propose:

```text
/lib/ai/schemas/callTriageAgentOutputV2Schema.ts
/lib/ai/schemas/toolRequestSchema.ts
```

Requirements:

```text
- matches api_contracts_agentic_proposal.md
- strict validation
- allowed patch fields only
```

## Phase M3-C — Controlled Runtime Tool Loop

Build:

```text
first pass → tool_requests
tool_results → second pass
```

Requirements:

```text
- no direct tool execution in model code
- backend owns execution
- mock tool results can be used for tests
```

## Phase M3-D — Call Triage Agent v2

Update prompts/examples for:

```text
normal
disaster
world_cup
multilingual
SMS draft
Mapbox/context tool requests
```

## Phase M3-E — Surge / GeoOps Agent

Build:

```text
runSurgeGeoOpsAgent
surge prompt
surge output schema
examples/tests
```

## Phase M3-F — Test Pack

Add example transcripts:

```text
stolen bike
active break-in
medical collapse
trapped person
gas smell
blocked road
lost child near fan zone
crowd pushing
lost tourist
non-English caller
```

---

## Safety Rules

The AI must not:

```text
- directly write Supabase
- call Twilio
- call ElevenLabs
- execute Mapbox MCP
- dispatch responders
- send SMS directly
- make final emergency decisions
```

The AI may:

```text
- classify
- summarize
- request tools
- recommend
- draft caller responses
- draft SMS text
- propose patches
```

Backend validates everything.

---

## Definition of Done

A Member 3 agentic phase is done when:

```text
- mock provider still works
- Gemma provider still works or falls back safely
- Featherless provider is behind env config
- output validates with Zod
- invalid JSON falls back safely
- tool requests are structured and validated
- tests/examples cover normal, disaster, and world_cup modes
- no backend state is mutated directly by AI code
- docs are updated
```

---

## Cursor Prompt Template

```text
I am Team Member 3: AI Agent Pipeline.

Read:
- docs/project_details.md
- docs/project_plan.md
- docs/api_contracts.md
- docs/api_contracts_agentic_proposal.md
- docs/agentic_ai_upgrade_plan.md
- docs/featherless_old_vs_new_architecture.md
- docs/team/member3_ai_agent_pipeline.md
- docs/team/member3_featherless_tool_agent_plan.md

Build only the requested Member 3 phase.
Do not edit dashboard UI, backend persistence, API routes, voice integrations, or Supabase migrations unless explicitly assigned.
AI must only return structured outputs/tool requests.
Backend validates and executes tools.
Keep mock fallback behavior working.
```
