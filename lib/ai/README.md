# `lib/ai` — AI Agent Pipeline

Owned by Teammate 3. This folder holds the controlled AI agent pieces for the
emergency operations platform. It currently supports a deterministic **mock**
provider for fallback/testing and **Featherless** as the real AI provider.

No database writes happen here. No Twilio / ElevenLabs / Mapbox / Supabase
calls happen here. Backend owns persistence, audit logs, transfers, SMS,
geocoding, and every external action. The AI layer only returns validated JSON
decisions.

## Folder layout

```
lib/ai/
├── agents/
│   ├── callTriageAgent.ts       # provider-aware runner (mock/featherless)
│   ├── mockCallTriageAgent.ts   # mock Call Triage Agent (deterministic)
│   ├── runControlledAgent.ts    # extracts/parses/validates model JSON
│   ├── surgeGeoOpsAgent.ts      # deterministic AI-side Surge / GeoOps helper
│   └── types.ts                  # AgentMode, TranscriptLike, input shape
├── providers/
│   └── featherlessClient.ts      # real-AI provider client
├── prompts/
│   ├── callTriageAgentV2Prompt.ts # draft future tool-agent triage prompt
│   ├── callTriagePrompt.ts       # active v1 triage prompt
│   └── surgeGeoOpsPrompt.ts      # draft future Surge / GeoOps prompt
├── schemas/
│   ├── callTriageAgentOutputV2Schema.ts # draft future agentic output schema
│   ├── surgeGeoOpsAgentOutputSchema.ts # Surge / GeoOps output validation
│   ├── toolRequestSchema.ts       # future agentic ToolRequest validation
│   ├── toolResultSchema.ts        # future backend ToolResult validation
│   └── triageAgentOutputSchema.ts # Zod schema + validateTriageAgentOutput
├── examples/
│   ├── agenticTriageExamples.ts  # future V2 tool-request examples
│   ├── mockTriageExamples.ts     # transcript fixtures + expected fields
│   ├── mockToolResults.ts        # static future ToolResult fixtures
│   ├── runMockTriageExamples.ts  # runs every fixture through the mock agent
│   └── surgeGeoOpsExamples.ts    # static Surge / GeoOps example inputs
└── README.md                     # this file
```

## Backend usage — Call Triage Agent

```ts
import { runCallTriageAgent } from "@/lib/ai/agents/callTriageAgent";

const result = await runCallTriageAgent({
  incident,
  callSession,
  latestTranscript,        // string OR { text } OR { final_transcript }
  transcriptHistory,       // optional
  mode: "normal",          // "normal" | "disaster" | "world_cup"
  provider: "featherless", // "mock" | "featherless"
});

// result is a validated TriageAgentOutput:
// { tool_requests, incident_patch, call_session_patch, system_actions, say_to_caller }
```

The provider-aware runner falls back to `mockCallTriageAgent` when:

- `provider` is `"mock"`;
- `AI_PROVIDER` is missing or unknown;
- `AI_PROVIDER=featherless` but `FEATHERLESS_API_KEY` is missing;
- Featherless fails, times out, or returns invalid JSON.

You can still import the mock directly for deterministic local checks:

```ts
import { mockCallTriageAgent } from "@/lib/ai/agents/mockCallTriageAgent";

const result = await mockCallTriageAgent({
  incident,
  callSession,
  latestTranscript,        // string OR { text } OR { final_transcript }
  transcriptHistory,       // optional
  mode: "normal",          // "normal" | "disaster" | "world_cup"
});

// result is a validated TriageAgentOutput:
// { tool_requests, incident_patch, call_session_patch, system_actions, say_to_caller }
```

The output is already validated against the Zod schema, so the backend can
merge `incident_patch` and `call_session_patch` after applying its own
business rules. Treat `tool_requests` and `system_actions` as **proposals**
only — the backend decides whether to execute them.

To validate raw LLM output from any real provider, reuse:

```ts
import { validateTriageAgentOutput } from "@/lib/ai/schemas/triageAgentOutputSchema";

const validated = validateTriageAgentOutput(rawJsonFromProvider);
```

## Local/demo environment

`.env.local` is manually managed and must not be committed. `.env.example` is
intentionally not used in this step.

Mock fallback/testing:

```env
AI_PROVIDER=mock
```

Current real AI testing/demo with Featherless:

```env
AI_PROVIDER=featherless
FEATHERLESS_API_KEY=your_real_key_here
FEATHERLESS_MODEL=model_name_here
```

Featherless is the real-AI provider. If Featherless fails or the key is
missing, `runCallTriageAgent` falls back to mock AI.

## Live voice state memory

The live voice path must pass `transcriptHistory` plus the current `Incident`
and `CallSession` into `runCallTriageAgent` on every final caller turn. If a
voice integration bypasses `runCallTriageAgent`, it must still include that
same state memory context in the provider prompt so known details are preserved
across turns.

`voiceSessionStore` now keeps expanded live triage memory for the ElevenLabs
path: urgency, summary, status/control state, operator/escalation flags,
location state, collected/missing fields, next/last question, last caller-facing
reply, transfer status, and a bounded recent final-turn transcript history. The
history stores compact caller/AI/operator/system turns only and is capped to the
most recent turns so live calls do not depend on raw webhook payloads.

This memory helps prevent repeated "where are you?" or "what happened?"
questions after those details were already collected. Collected fields merge
across turns, while missing fields are only replaced by an explicit validated
list from the backend/AI result.

To debug repeated questions in the live voice flow, set
`ECC_VOICE_DEBUG=true` locally and inspect `[ECC Voice Debug] before-ai`,
`after-ai`, and `after-merge` logs. These compact logs show transcript excerpts,
bounded transcript-history length, next/last question, state keys, missing
fields, provider, and merged triage state without logging API keys, auth
headers, or raw request bodies.

## Call Transfer and Dispatch Wording Rules

AI only recommends transfer through structured fields. Backend checks operator
availability and decides whether transfer should happen; voice/Twilio performs
the actual live call transfer.

Caller-facing responses must not imply dispatch, transfer, or notification has
occurred unless backend, voice, or an operator has confirmed it. Avoid "help is
on the way", "police are coming", "firefighters are coming", "ambulance is
coming", "unit dispatched", "non-emergency unit dispatched",
"officer dispatched", "responder dispatched", "someone is on the way",
"a team has been sent", or "authorities have been notified" for report-intake
cases like bike theft, safe vehicle theft, or lost property.

Safe property reports, lost items, and vehicle theft where the caller is safe
should stay with AI intake unless danger appears or backend state says an
operator is needed. There is no priority queue logic for now.

For non-emergency property reports, the AI should follow an intake checklist
and ask one useful missing-detail question at a time. It should not drift into
generic closing loops like "Do you need help with anything else?" or "Do you
want me to stay on the line?" until enough report details are collected.

## Mock examples — sanity check the wiring

```ts
import { runMockTriageExamples } from "@/lib/ai/examples/runMockTriageExamples";

const results = await runMockTriageExamples();
console.table(
  results.map((r) => ({
    id: r.id,
    pass: r.pass,
    urgency: r.actual.urgency,
    incident_type: r.actual.incident_type,
  }))
);
```

Each result includes:

- `id`, `name`, `transcript`
- `expected` urgency / incident_type / operator_required / should_escalate
- `actual` urgency / incident_type / operator_required / should_escalate
- `pass` (true only when all four expected fields match)
- `say_to_caller`
- `error` (only present if the agent threw)

This is **not** a test framework — no Jest/Vitest needed. It is a plain
async helper backend or a developer can call manually (e.g. from a script,
a debug page, or a temporary `/api/debug/...` route during development).

## Agentic Tool Schema Preparation

The future agentic flow will let AI request safe backend tools using
`ToolRequest` objects from `schemas/toolRequestSchema.ts`. The AI still does
not execute tools. It only proposes a validated request such as
`geocode_location`, `event_zone_lookup`, `responder_lookup`, or `sms_draft`.

Backend owns the full execution path:

```text
AI ToolRequest[]
→ backend validates allowed tools and args
→ backend executes tools
→ backend returns ToolResult[]
→ AI may reason over ToolResult[] later
→ backend validates final AI output before state changes
```

`ToolResult` objects from `schemas/toolResultSchema.ts` are backend-produced
normalized results. Member 3 code only validates those results for future
reasoning passes; it does not call Mapbox, Supabase, database helpers, or any
tool executor.

Current v1 call triage remains unchanged. No tool execution is implemented in
Member 3 code.

## Call Triage Agent Output V2 Draft

`schemas/callTriageAgentOutputV2Schema.ts` is a draft schema for the future
agentic mode. The current MVP still uses `triageAgentOutputSchema.ts`; V2 is
not wired into `/api/call/turn` and does not replace the active v1 runtime.

V2 adds structured fields for:

- language state;
- high-level agent decision;
- caller response;
- operator recommendation;
- SMS draft state;
- map recommendation;
- confidence scores;
- structured `ToolRequest[]`.

This schema is meant for the future tool-aware flow where the AI can request
safe tools, backend validates and executes them, backend returns normalized
tool results, and the AI reasons over those results before producing a final
validated output.

Backend/tool runtime must be ready before V2 is wired into `/api/call/turn`.
Member 3 owns the AI schema and prompt side. Member 1/backend owns tool
execution, persistence, audit logs, and all external actions.

## Agentic Prompt Drafts

`prompts/callTriageAgentV2Prompt.ts` and `prompts/surgeGeoOpsPrompt.ts` are
draft prompts for the future V2/tool-agent mode.

The current v1 runtime still uses `prompts/callTriagePrompt.ts`. These new
prompts are not wired into `/api/call/turn` yet and do not change the current
mock/Featherless fallback flow.

The V2 prompt drafts describe how AI can request safe backend tools, but tool
execution is backend-owned. Member 3 owns the prompt and schema side. Member
1/backend owns the safe tool registry, tool request validation, ToolResult
execution, persistence, audit logs, and all external actions.

## Agentic Examples and Mock Tool Results

`examples/agenticTriageExamples.ts` contains static examples for future
Call Triage Agent V2 behavior. Each example shows the expected decision and
the `ToolRequest[]` a future agentic triage pass might return for common
scenarios such as stolen bike geocoding, disaster context lookup, event-zone
lookup, nearest help-point lookup, and responder/route planning.

`examples/mockToolResults.ts` contains static `ToolResult` fixtures for future
tests and demos. These fixtures represent normalized backend-produced results
for geocoding, event zones, help points, responder lookup, route placeholder
data, context lookup, and SMS draft output.

These files are not wired into runtime. They do not execute tools, call
providers, call Mapbox, call Supabase, or touch backend routes. Backend still
owns tool execution and ToolResult production. Current v1 flow remains
unchanged.

## Surge / GeoOps Agent

`runSurgeGeoOpsAgent` is an AI-side helper for future surge analysis across
many active incidents. It currently uses deterministic safe behavior only:
grouping incidents, ranking critical/urgent incidents, summarizing clusters,
and validating the result with `surgeGeoOpsAgentOutputSchema`.

It does not call Featherless yet. It does not execute tools, call
Mapbox, call Supabase, mutate the database, or touch dashboard state. The
`/api/surge/analyze` route now exposes it as a thin analysis endpoint.

Usage:

```ts
import { runSurgeGeoOpsAgent } from "@/lib/ai/agents/surgeGeoOpsAgent";

const result = await runSurgeGeoOpsAgent({
  mode: "disaster",
  activeIncidents,
  responders,
  eventLayers,
  recentToolResults,
  provider: process.env.AI_PROVIDER,
});
```

API usage:

```http
POST /api/surge/analyze
Content-Type: application/json

{
  "mode": "disaster",
  "activeIncidents": [
    {
      "id": "DIS-001",
      "urgency": "critical",
      "incident_type": "trapped_person",
      "coordinates": { "lat": 43.4651, "lng": -80.5229 }
    }
  ]
}
```

Response shape:

```json
{
  "ok": true,
  "analysis": {
    "schema_version": "1.0",
    "mode": "disaster",
    "clusters": [],
    "top_priority_incident_ids": []
  }
}
```

The endpoint returns validated analysis JSON only. It does not mutate the
database, call Mapbox directly, execute external tools, or dispatch responders.
Dashboard/backend persistence and visualization can be wired later.

`examples/surgeGeoOpsExamples.ts` provides static example inputs for disaster,
World Cup, and empty-incident fallback scenarios. These examples are not run
automatically.

## What backend should do next

- Wire `runCallTriageAgent` into `/api/call/turn` so transcript turns flow
  through the selected provider and the validated patch is merged into Supabase.
- Use `provider: process.env.AI_PROVIDER` so demo/local environments can switch
  between mock and Featherless.
- Keep treating `tool_requests` and `system_actions` as proposals; backend
  is the only component that executes transfers, SMS, geocoding, etc.

## What this folder must NOT do

- No direct database writes (no Supabase calls).
- No Twilio / ElevenLabs / Mapbox calls. Featherless calls stay inside the
  controlled provider client.
- Only read provider config from `process.env`; do not edit env files.
- No installing new packages without team approval.
- No modifying API routes, dashboard, map, or DB helpers.
