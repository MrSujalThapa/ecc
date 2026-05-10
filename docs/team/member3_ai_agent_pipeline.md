# Member 3 — AI Agent Pipeline

## Role Summary

I am responsible for **Teammate 3: AI Agent Pipeline** for the AI Emergency Operations Platform hackathon project.

My part focuses on building the AI triage layer that receives a caller transcript, understands the incident, classifies urgency, identifies missing information, and returns a structured response for the backend.

The AI does **not** directly update Supabase, dispatch responders, call Twilio, control ElevenLabs, control Mapbox, or make final emergency decisions. The backend validates all AI output and performs all state changes.

---

## Main Responsibility

My main responsibility is to provide a reusable AI function that the backend can call:

```ts
runCallTriageAgent({
  incident,
  callSession,
  latestTranscript,
  transcriptHistory,
  mode,
  provider,
});
```

The function should support:

```text
mock        = fallback/testing provider
featherless = real AI provider
```

---

## Main Flow

```text
Caller transcript
→ AI triage agent
→ validated JSON output
→ backend updates Incident and CallSession
→ dashboard and Mapbox update
→ operator takes over when needed
```

---

## Build Strategy

The AI pipeline is being built in stages:

```text
Mock AI first
→ Backend integration check
→ Featherless real-AI provider
→ Mock fallback protection
```

This keeps the hackathon demo safe because the system can still work with mock AI if the real provider fails.

---

## Current Provider Plan

### 1. Mock Provider

Used for backend testing, fallback behavior, and safe demo recovery.

```env
AI_PROVIDER=mock
```

### 2. Featherless Provider

Used as the current real AI provider for testing and demo.

```env
AI_PROVIDER=featherless
FEATHERLESS_API_KEY=your_real_key_here
FEATHERLESS_MODEL=model_name_here
```

---

## Local Environment Variables for My Part Only

Use `.env.local` manually. Do **not** commit `.env.local`.

```env
# AI provider for Teammate 3 AI pipeline
# mock = safe fallback / backend testing
# featherless = current real AI testing/demo

AI_PROVIDER=mock

# Current real AI provider: Featherless
FEATHERLESS_API_KEY=
FEATHERLESS_MODEL=
```

For current mock testing:

```env
AI_PROVIDER=mock
```

For current real AI testing/demo with Featherless:

```env
AI_PROVIDER=featherless
FEATHERLESS_API_KEY=your_real_key_here
FEATHERLESS_MODEL=model_name_here
```

---

## Phase 1 — Mock AI Triage Agent

### Purpose

The mock AI agent allows backend and dashboard teammates to test the full application flow before connecting any real AI provider.

### Mock flow

```text
Mock transcript
→ /api/call/turn
→ mockCallTriageAgent
→ validated AI output
→ Incident + CallSession update
→ dashboard / Mapbox update
```

### Files

```text
/lib/ai/schemas/triageAgentOutputSchema.ts
/lib/ai/prompts/callTriagePrompt.ts
/lib/ai/agents/types.ts
/lib/ai/agents/mockCallTriageAgent.ts
```

### Mock Agent Cases

The mock agent handles:

```text
stolen bike / bike theft / stolen item
active break-in
medical collapse / unconscious person
gas smell
fire
trapped person
lost item
lost child / missing person
crowd pushing / stadium crowd surge
unclear caller message
```

### Example Mock Input

```text
Someone stole my bike near Dana Porter Library.
```

### Example Mock Output

```json
{
  "tool_requests": [],
  "incident_patch": {
    "urgency": "non_emergency",
    "incident_type": "bike_theft",
    "operator_required": false,
    "status": "active_call",
    "control_state": "ai_leading",
    "ai_active": true,
    "location": "Dana Porter Library",
    "location_status": "approximate_by_ai",
    "location_confidence": 0.86,
    "coordinates": {
      "lat": 43.4699,
      "lng": -80.5424
    },
    "missing_fields": [
      "item_description",
      "time_of_theft",
      "suspect_seen",
      "callback_number"
    ],
    "recommended_action": "Continue AI intake and collect theft report details."
  },
  "call_session_patch": {
    "ai_active": true,
    "should_escalate": false,
    "next_question": "Can you describe the item and tell me when it happened?"
  },
  "system_actions": [],
  "say_to_caller": "Can you describe the item and tell me when it happened?"
}
```

---

## Phase 2 — Mock Transcript Examples

### Purpose

Mock examples help backend and developers verify that the mock AI output matches expected behavior.

### Files

```text
/lib/ai/examples/mockTriageExamples.ts
/lib/ai/examples/runMockTriageExamples.ts
/lib/ai/README.md
```

### Example Usage

```ts
import { runMockTriageExamples } from "@/lib/ai/examples/runMockTriageExamples";

const results = await runMockTriageExamples();
console.table(results);
```

### Example Scenarios

```text
stolen bike near Dana Porter Library
active break-in
medical collapse
gas smell after earthquake
lost child near fan zone
crowd pushing near stadium gate
lost item
unclear caller message
```

---

## Phase 3 — Backend Integration Handoff

### Purpose

The backend teammate needs a clear guide for importing and using the mock AI agent without guessing the input/output structure.

### File

```text
/lib/ai/BACKEND_INTEGRATION.md
```

### Backend Mock Import

```ts
import { mockCallTriageAgent } from "@/lib/ai/agents/mockCallTriageAgent";
```

### Backend Mock Call

```ts
const aiResult = await mockCallTriageAgent({
  incident,
  callSession,
  latestTranscript,
  transcriptHistory,
  mode,
});
```

### Backend Responsibilities

The backend should:

```text
1. Receive final transcript turn
2. Save TranscriptEvent
3. Load Incident and CallSession
4. Call mockCallTriageAgent or runCallTriageAgent
5. Validate AI output
6. Update Incident
7. Update CallSession
8. Write AuditLog
9. Return say_to_caller
```

---

## Phase 4 — Featherless Real AI Provider

### Purpose

Featherless is the current real AI provider for testing/demo.

### Planned / Current Files

```text
/lib/ai/providers/featherlessClient.ts
/lib/ai/agents/callTriageAgent.ts
/lib/ai/agents/runControlledAgent.ts
```

### Final Backend Import

```ts
import { runCallTriageAgent } from "@/lib/ai/agents/callTriageAgent";
```

### Final Backend Call

```ts
const aiResult = await runCallTriageAgent({
  incident,
  callSession,
  latestTranscript,
  transcriptHistory,
  mode,
  provider: process.env.AI_PROVIDER,
});
```

### Provider Behavior

```text
AI_PROVIDER=mock
→ use mockCallTriageAgent

AI_PROVIDER=featherless
→ call Featherless provider

Featherless key missing / timeout / invalid JSON
→ fallback to mockCallTriageAgent
```

---

## Phase 5 — Voice State Memory

The live voice path must pass transcript and state memory into the AI on every
final caller turn.

The backend call should use:

```ts
runCallTriageAgent({
  incident,
  callSession,
  latestTranscript,
  transcriptHistory,
  mode,
  provider: process.env.AI_PROVIDER,
});
```

If a live voice path bypasses `runCallTriageAgent`, it must still include:

```text
transcriptHistory
current Incident
current CallSession
```

This prevents the AI from asking for emergency type, location, or description
again after those details were already collected.

For the ElevenLabs live voice path, `voiceSessionStore` preserves expanded
triage memory between turns: urgency, summary, status/control state,
operator/escalation flags, location state, collected and missing fields,
next/last question, last caller-facing reply, transfer status, and a bounded
recent final-turn transcript history. The history stores compact caller/AI
turns only and keeps the most recent turns, so it gives the AI continuity
without storing raw webhook payloads.

This helps prevent repeated location or "what happened?" questions. Collected
fields merge across turns, while missing fields are preserved unless the
backend/AI result returns an explicit replacement list. With
`ECC_VOICE_DEBUG=true`, voice debug logs show the bounded transcript-history
length, next/last question, missing fields, collected-field keys, urgency,
summary excerpt, operator-required, and escalation state without logging phone
numbers or secrets.

---

## AI Output Shape

All AI providers must return the same validated structure:

```text
tool_requests
incident_patch
call_session_patch
system_actions
say_to_caller
```

The backend should never trust raw AI output. It must validate the output before updating any state.

---

## Safety Rules

The AI agent must follow these rules:

```text
AI does not write directly to Supabase.
AI does not dispatch responders.
AI does not call Twilio directly.
AI does not control ElevenLabs directly.
AI does not control Mapbox directly.
AI only returns structured decisions.
Backend validates and executes actions.
Human operators remain in control.
```

### Call Transfer and Dispatch Wording Rules

AI only recommends transfer through structured fields. Backend checks operator
availability and decides whether transfer should happen; voice/Twilio performs
the actual live call transfer.

Caller-facing responses must not imply dispatch, transfer, or notification has
occurred unless backend, voice, or an operator has confirmed it. For bike theft,
safe vehicle theft, and property report intake, the AI should collect details
and avoid phrases like "help is on the way", "police are coming",
"firefighters are coming", "ambulance is coming", "unit dispatched",
"non-emergency unit dispatched", "officer dispatched", "responder dispatched",
"someone is on the way", "a team has been sent", or "authorities have been
notified."

Safe property reports, lost items, and vehicle theft where the caller is safe
should stay with AI intake unless danger appears or backend state says an
operator is needed. There is no priority queue logic for now.

For non-emergency property reports, the AI should follow an intake checklist
and ask one useful missing-detail question at a time. It should not drift into
generic closing loops like "Do you need help with anything else?" or "Do you
want me to stay on the line?" until enough report details are collected.

To debug repeated questions in live voice flow, set `ECC_VOICE_DEBUG=true`
locally and inspect `[ECC Voice Debug] before-ai`, `after-ai`, and
`after-merge` logs. These logs summarize transcript excerpts, cached state,
missing fields, provider, AI patches, and merged state without logging secrets
or raw request bodies.

---

## What I Need From Teammates

### From Teammate 1 — Backend / Integration

I need:

```text
/lib/types/incident.ts
/lib/types/call-session.ts
/lib/types/transcript-event.ts
/lib/types/api.ts
/api/call/turn request shape
/api/call/turn expected response shape
```

Backend needs to connect my AI function to:

```text
/app/api/call/turn/route.ts
```

I should not edit this route unless requested.

---

### From Teammate 2 — Twilio / ElevenLabs

I need the final transcript payload shape.

Expected shape:

```json
{
  "incident_id": "...",
  "call_session_id": "...",
  "speaker": "caller",
  "text": "caller final transcript here",
  "is_final": true,
  "source": "elevenlabs"
}
```

Important:

```text
Only final transcript turns should trigger AI.
Partial transcript should not call AI every word.
```

---

### From Teammate 4 — Dashboard / Mapbox

Dashboard should display fields from:

```text
incident_patch
call_session_patch
```

Important fields:

```text
urgency
incident_type
status
operator_required
control_state
ai_active
location_status
location
coordinates
summary
collected_fields
missing_fields
recommended_action
next_question
should_escalate
operator_transfer_status
```

---

## Branch and Git Workflow

My branch:

```text
feature/member-3
```

Rules:

```text
Do not push to main.
Do not merge into main without team approval.
Commit after every substep.
Push only to origin feature/member-3.
Keep working tree clean before moving to next phase.
```

Useful commands:

```bash
git status
git branch
git push origin feature/member-3
```

---

## Current Completed Work

Completed so far:

```text
Prompt 1 — Mock AI triage foundation
Prompt 2 — Mock transcript examples
Prompt 3 — Backend integration handoff document
```

Checks passed:

```text
npm run lint
npx tsc --noEmit
npm run build
```

---

## Docs Folder Placement

Team requested docs structure:

```text
docs/
├── project_details.md
├── project_plan.md
├── api_contracts.md
└── team/
    └── member3_ai_agent_pipeline.md
```

This file should be placed at:

```text
docs/team/member3_ai_agent_pipeline.md
```

---

## Surge / GeoOps Status

Done:

```text
Surge / GeoOps output schema
runSurgeGeoOpsAgent helper
/api/surge/analyze route wired for functional analysis
```

Left:

```text
optional database persistence of cluster_id / priority_score
dashboard visualization of GeoOps recommendations
optional model-backed Featherless GeoOps reasoning
optional Mapbox route/help-point visualization
backend/operator confirmation for any real actions
```

The current `/api/surge/analyze` route returns validated analysis JSON only. It
does not mutate Supabase, call Mapbox directly, execute external tools, or
dispatch responders.

---

## Final Hackathon Demo Flow

The final demo flow should be:

```text
Caller calls Twilio number
→ ElevenLabs talks to caller
→ ElevenLabs sends final transcript to backend
→ Backend calls runCallTriageAgent
→ AI returns validated JSON
→ Backend updates Incident + CallSession
→ Supabase realtime updates dashboard
→ Mapbox shows incident
→ If emergency, backend/Twilio transfers to operator
```

---

## My Final Deliverable

The final reusable function should be:

```ts
runCallTriageAgent({
  incident,
  callSession,
  latestTranscript,
  transcriptHistory,
  mode,
  provider,
});
```

Provider options:

```text
mock
featherless
```

Mock AI remains fallback so the demo still works if real AI fails.
