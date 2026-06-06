# Member 2 — Voice + Telephony Agentic Integration Plan

## Role Summary

You are **Team Member 2: Voice + Telephony**.

Your job is to make the live phone/demo call path reliable. You own the layer between the caller, Twilio, ElevenLabs, transcript events, call transfer, and SMS. The backend owns state and AI execution. The dashboard visualizes the backend state.

The goal is:

```text
Caller phone
→ Twilio demo number
→ ElevenLabs voice agent
→ backend transcript/call endpoints
→ Featherless/Gemma/mock AI triage through backend
→ backend validates and updates Incident + CallSession
→ dashboard updates
→ operator takeover / transfer / SMS when needed
```

Member 2 should **not** call Featherless directly, run AI prompts directly, write to Supabase directly, call Mapbox MCP directly, or mutate dashboard state. Member 2 sends voice/call events to the backend and uses backend responses to decide what the voice layer says or does next.

---

## Source-of-Truth Docs

Before coding, read:

```text
docs/project_details.md
docs/project_plan.md
docs/api_contracts.md
docs/agentic_ai_upgrade_plan.md
docs/featherless_old_vs_new_architecture.md
docs/api_contracts_agentic_proposal.md
docs/team/member1_fullstack_integration.md
docs/team/member3_ai_agent_pipeline.md
docs/team/member2_voice_telephony_agentic_integration_plan.md
```

Important contract rule:

```text
docs/api_contracts.md = current active implementation contract
docs/api_contracts_agentic_proposal.md = future proposal for upgraded tool-using agents
```

Do not implement proposal-only fields until the team explicitly promotes them into active contracts and code.

---

## Current Architecture Boundary

The safe architecture is:

```text
Voice layer captures call/transcript
→ backend owns state
→ backend calls AI agent
→ AI returns structured decisions/tool requests
→ backend validates and executes
→ backend updates database
→ dashboard visualizes
→ operator can override
```

Member 2 owns the **voice transport** and **caller interaction reliability**.

Member 2 does **not** own:

```text
- AI prompts or Featherless model behavior
- backend tool registry
- Mapbox MCP runtime execution
- Supabase persistence logic
- dashboard/Mapbox rendering
- emergency dispatch decisions
```

---

## Existing APIs To Use

Use the active backend APIs from `docs/api_contracts.md`.

### Call lifecycle

```text
POST /api/call/start
POST /api/call/turn
POST /api/call/end
```

### Operator actions relevant to voice

```text
POST /api/operator/takeover
POST /api/operator/send-sms
```

### Existing dev/test helpers

```text
GET /api/dev/persistence
GET /api/dev/incidents
/dev/voice-sim
```

`/dev/voice-sim` is useful for testing the call flow before real Twilio/ElevenLabs wiring is fully ready.

---

## Required Environment Variables

Do not commit `.env.local`.

Expected voice/telephony variables later:

```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_OPERATOR_FORWARD_NUMBER=

ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
ELEVENLABS_WEBHOOK_SECRET=

AI_PROVIDER=mock
```

For local development before real voice integration, keep:

```env
AI_PROVIDER=mock
```

Real AI provider setup is Member 3's responsibility. Member 2 should not need `FEATHERLESS_API_KEY` unless the team explicitly assigns voice-layer testing that requires it.

---

## Do Not Touch Unless Explicitly Assigned

Avoid modifying:

```text
/lib/ai/*
/lib/db/*
/lib/server/*
/lib/supabase/*
/lib/validation/*
/components/dashboard/*
/components/map/*
supabase/migrations/*
```

You may work in voice/telephony areas such as:

```text
/app/api/twilio/*
/app/api/elevenlabs/*
/lib/voice/*
/lib/telephony/*
/lib/simulate/* only if needed for voice simulation
components/dev/* only if improving voice dev harness
```

Do not change shared API contracts or domain types unless the team explicitly agrees.

---

# Build Order

## Phase 1 — Understand Current Backend Call Flow

### Purpose

Before wiring Twilio/ElevenLabs, verify the backend call lifecycle works through existing endpoints.

### Tasks

1. Read active call API contracts.
2. Use `/dev/voice-sim` to understand expected call flow.
3. Verify the backend supports:

```text
start call
→ send final transcript turn
→ receive say_to_caller
→ end call
```

### Expected behavior

`POST /api/call/turn` should receive final transcript text and return:

```text
say_to_caller
incident
call_session
transcript_event
actions
```

### Definition of Done

- You can explain how `POST /api/call/start`, `/turn`, and `/end` work.
- You know which fields ElevenLabs/Twilio need to pass to backend.
- You do not need to change backend code for this phase.

---

## Phase 2 — Create Voice/Telephony Wrapper Structure

### Purpose

Create clean wrappers so Twilio/ElevenLabs code does not become scattered across route handlers.

### Suggested files

```text
/lib/voice/elevenlabsTypes.ts
/lib/voice/elevenlabsWebhookParser.ts
/lib/voice/twilioTypes.ts
/lib/voice/twilioClient.ts
/lib/voice/callRouting.ts
/lib/voice/smsClient.ts
/lib/voice/voiceConfig.ts
```

### Requirements

- Keep wrappers typed.
- Keep secrets server-side only.
- Do not call AI directly from wrappers.
- Do not write Supabase directly from wrappers.
- Route handlers should parse provider payloads and call existing backend APIs/helpers.

### Definition of Done

- Voice wrapper files exist.
- No provider secrets are exposed to the frontend.
- No direct AI/Supabase calls are added.

---

## Phase 3 — Implement Twilio Inbound Call Entry

### Purpose

When a real caller calls the Twilio number, create or connect to a backend `Incident` and `CallSession`.

### Suggested files

```text
/app/api/twilio/webhook/route.ts
/lib/voice/twilioClient.ts
/lib/voice/callRouting.ts
```

### Flow

```text
Incoming Twilio call
→ backend receives webhook
→ call /api/call/start or repository helper
→ store twilio_call_sid
→ route caller to ElevenLabs agent or configured voice path
```

### Requirements

- Preserve `twilio_call_sid` when available.
- Choose mode: default `normal`, or allow demo query/config for `disaster` / `world_cup`.
- Do not hardcode private phone numbers in code.
- Do not bypass backend Incident/CallSession creation.

### Definition of Done

- A Twilio inbound webhook can create a backend call session.
- The dashboard can later see the created incident through existing incident APIs.
- Errors are logged without exposing secrets.

---

## Phase 4 — Implement ElevenLabs Transcript Ingestion

### Purpose

Send final transcript turns from ElevenLabs to the backend call-turn endpoint.

### Suggested files

```text
/app/api/elevenlabs/webhook/route.ts
/lib/voice/elevenlabsWebhookParser.ts
/lib/voice/elevenlabsTypes.ts
```

### Flow

```text
ElevenLabs transcript event
→ parse provider payload
→ determine incident_id + call_session_id
→ if transcript is final, call /api/call/turn
→ read say_to_caller from response
→ return/trigger next voice response depending on integration mode
```

### Critical rule

```text
Partial transcript = optional display/logging only
Final transcript = backend AI reasoning
```

Do not call the AI model after every word.

### Requirements

- Preserve `elevenlabs_conversation_id` when available.
- Send only final caller transcript turns to `/api/call/turn` for AI reasoning.
- Include language/translated_text when available.
- Do not create custom transcript shape outside active contracts.

### Definition of Done

- Final transcript turns reach `/api/call/turn`.
- Backend returns `say_to_caller`.
- AI reasoning remains backend-owned.
- [x] Durable call identity is persisted and resolved by `twilio_call_sid` / `elevenlabs_conversation_id` before routing transcript turns, and unsafe fallback refuses to guess when multiple live sessions exist.

---

## Phase 5 — Voice Response Loop

### Purpose

Make the voice agent speak the backend's next safe response.

### Flow

```text
Caller says something
→ ElevenLabs transcript webhook
→ /api/call/turn
→ backend returns say_to_caller
→ voice layer says that to caller
```

### Requirements

- Keep responses short and caller-safe.
- Do not generate your own independent LLM response in the voice layer.
- If `say_to_caller` is null, use a safe fallback phrase.
- If backend indicates transfer/escalation, follow transfer path.

### Safe fallback phrase

```text
I want to make sure I understood. Can you briefly repeat what happened?
```

### Definition of Done

- Caller can have a basic multi-turn call.
- Voice layer follows backend `say_to_caller`.
- Non-emergency calls can continue AI intake.
- Urgent calls can move toward transfer flow.

---

## Phase 6 — Emergency Transfer Path

### Purpose

When backend/AI determines that an operator is required, transfer the call to the demo operator phone.

### Suggested files

```text
/lib/voice/callRouting.ts
/lib/voice/twilioClient.ts
/app/api/twilio/transfer/route.ts if needed
```

### Flow

```text
Backend marks incident operator_required / transferring_to_operator
→ voice layer requests transfer
→ Twilio transfers call to operator number
→ backend/operator endpoint updates status
→ dashboard shows human_active / transferred status
```

### Requirements

- Do not transfer just because raw transcript sounds urgent. Use backend-validated state/actions.
- If possible, ask for location before transfer when backend instructs it.
- Preserve `operator_transfer_status`.
- If transfer fails, report failure to backend and dashboard.

### Definition of Done

- Emergency demo call can transfer to operator phone.
- Dashboard state reflects transfer status.
- Failure path is visible and safe.

---

## Phase 7 — SMS Confirmation / Summary

### Purpose

Send short factual SMS messages after completion, escalation, or operator action.

### Current reality

`POST /api/operator/send-sms` may currently be a stub. Member 2 can later implement real Twilio SMS behind the backend route if assigned.

### Flow

```text
Backend/operator requests SMS
→ voice/SMS helper sends via Twilio
→ backend records provider_message_id if available
→ dashboard reports sent/stub/failed honestly
```

### Requirements

- SMS must be factual and short.
- Do not include unnecessary sensitive information.
- Do not promise emergency dispatch.
- Use backend-approved message text.
- Support future multilingual SMS when language is available.

### Example SMS

```text
Report INC-402 received. Summary: medical assistance requested near Gate 3. If this becomes life-threatening, contact emergency services immediately.
```

### Definition of Done

- SMS helper exists or backend stub behavior is clearly documented.
- Dashboard can honestly show whether SMS was sent, stubbed, or failed.

---

## Phase 8 — Multilingual Voice Handling

### Purpose

Support multilingual callers across normal, disaster, and world_cup modes.

### Current MVP expectation

Multilingual support can be basic:

```text
Detect language if provider supplies it
store original transcript
store translated_text if available
send language metadata to backend
backend/AI decides response language
```

### Requirements

- Preserve original caller text.
- Include `language` and `translated_text` fields when available.
- Do not translate in the voice layer unless explicitly assigned.
- If the backend returns a response in caller language, voice layer should speak that response.

### Definition of Done

- Transcript payloads can carry language metadata.
- World Cup demo can include multilingual transcript examples.
- No frontend/dashboard assumptions are required.

---

## Phase 9 — Disaster + World Cup Demo Voice Scripts

### Purpose

Make the live demo reliable and repeatable.

### Demo scenarios

Normal mode:

```text
stolen bike / lost item
minor report
urgent but non-life-threatening assistance
```

Emergency mode:

```text
active break-in
medical collapse
trapped person
```

Disaster mode:

```text
earthquake surge
blocked road
gas smell
person trapped
power outage
```

World Cup mode:

```text
lost tourist
lost child/person
medical tent request
crowd pushing near gate
transit disruption
security/theft issue
multilingual caller
```

### Requirements

- Write short caller scripts.
- Write expected backend state changes.
- Write expected dashboard visual results.
- Keep scripts safe and non-graphic.

### Definition of Done

- Team can run the same demo repeatedly.
- Member 4 can know which dashboard changes should appear.
- Member 3 can know which transcript cases to test.

---

## Phase 10 — Integration With Member 1, 3, and 4

### Member 1 integration

Member 1 owns backend endpoints, persistence, and tool execution.

Member 2 should coordinate with Member 1 for:

```text
- Twilio webhook route shape
- ElevenLabs webhook route shape
- call/start, call/turn, call/end integration
- transfer status persistence
- SMS provider integration
- audit logs for call transfer/SMS
```

### Member 3 integration

Member 3 owns AI prompts, schemas, and Featherless/Gemma/mock provider behavior.

Member 2 should coordinate with Member 3 for:

```text
- final transcript format
- language/translated_text behavior
- say_to_caller expectations
- emergency escalation behavior
- fallback response behavior
```

### Member 4 integration

Member 4 owns the dashboard.

Member 2 should provide backend-visible state so Member 4 can display:

```text
- live/active call status
- transferring status
- transferred/human_active status
- SMS sent/stub/failed status
- transcript URL or transcript events when available
- caller language badge when available
```

### Definition of Done

- A live/simulated call updates backend incidents.
- Dashboard can show the call state.
- Emergency transfer status is visible.
- SMS status is visible or clearly stubbed.

---

## Phase 11 — Reliability + Demo Hardening

### Purpose

Make the phone demo reliable under time pressure.

### Checklist

- Twilio number configured.
- ElevenLabs agent configured.
- Webhooks reachable in local tunnel or deployed environment.
- Environment variables set in deployment.
- One normal demo call works end-to-end.
- One emergency transfer works end-to-end.
- One failed transfer path is safe.
- Backend fallback behavior is documented.
- Dashboard still updates after calls.
- SMS is either real or honestly stubbed.

### Definition of Done

- Demo caller can call the number.
- AI/voice asks short questions.
- Backend receives final transcript turns.
- Dashboard updates incidents.
- Emergency transfer works or fails safely.
- Team has a fallback plan if live voice fails.

---

# Agentic Architecture Notes For Member 2

The new agentic upgrade uses Featherless and Mapbox MCP more powerfully, but Member 2 should not directly implement those pieces.

## Old/simple AI flow

```text
Transcript
→ AI triage output
→ backend validates
→ backend updates incident
```

## New upgraded flow

```text
Transcript
→ Featherless agent requests safe tools
→ backend validates tool requests
→ backend executes tools such as Mapbox MCP / mock lookup / RAG-lite context
→ tool results return to agent/backend
→ backend validates final output
→ incident/dashboard updates
```

Member 2's job in this upgraded flow is to provide clean, final transcript turns and caller metadata.

Useful metadata Member 2 can provide:

```text
- twilio_call_sid
- elevenlabs_conversation_id
- final transcript text
- is_final
- speaker
- language
- translated_text
- call status
- transfer status
- phone/SMS status if available
```

---

# What Not To Overbuild

Do not build first:

```text
- live audio playback in dashboard
- operator-side dictation
- full streaming STT replacement
- complex multilingual translation pipeline
- autonomous dispatch
- direct Mapbox MCP calls from voice layer
- direct Featherless calls from voice layer
```

Build the reliable phone/transcript/transfer/SMS pipeline first.

---

# Cursor Prompt Template For Member 2

Use this when starting a new Cursor chat:

```text
I am Team Member 2: Voice + Telephony.

Read:
- docs/project_details.md
- docs/project_plan.md
- docs/api_contracts.md
- docs/agentic_ai_upgrade_plan.md
- docs/featherless_old_vs_new_architecture.md
- docs/team/member1_fullstack_integration.md
- docs/team/member3_ai_agent_pipeline.md
- docs/team/member2_voice_telephony_agentic_integration_plan.md

Use docs/api_contracts.md as the active implementation contract.
Use docs/api_contracts_agentic_proposal.md only for future compatibility awareness if present.

My responsibility:
- Twilio inbound call setup
- ElevenLabs transcript ingestion
- final transcript delivery to /api/call/turn
- call transfer path
- SMS helper/provider integration if assigned
- reliable demo scripts and fallback behavior

Rules:
- Do not call Featherless directly.
- Do not call Mapbox MCP directly.
- Do not write to Supabase directly.
- Do not mutate dashboard state.
- Do not change shared types/API contracts without team approval.
- Backend owns state and AI execution.
- Voice layer sends provider events to backend and follows backend response.

Before editing:
- confirm branch
- confirm git status is clean
- pull latest main if safe
- stop on merge conflicts

After each substep:
- run relevant checks
- test the voice/API path if possible
- update relevant docs
- commit and push only relevant files
- stop and summarize files changed, checks, and warnings
```

---

# Final Deliverable For Member 2

The final Member 2 deliverable is:

```text
A reliable voice/telephony path where a real or simulated caller can speak to the system, final transcript turns reach the backend, backend AI/state updates occur, emergency calls can transfer to an operator, SMS behavior is real or clearly stubbed, and the dashboard has enough state to visualize call/transfer/SMS status.
```
