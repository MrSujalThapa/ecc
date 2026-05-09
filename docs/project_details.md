# Project Details — AI Emergency Operations Platform

## 1. One-Line Summary

We are building an **AI emergency operations platform for operators** that helps cities handle call surges by letting AI voice agents triage incoming calls, collect critical details, escalate serious emergencies to humans, and visualize incidents on a live command map.

## 2. Product Explanation

During disasters, major events, and high-tourism moments like the FIFA World Cup, emergency lines can receive more calls than available operators can handle. Our system helps operators manage that overload.

Instead of every caller waiting for a human operator, an AI voice agent can immediately answer, understand the situation, gather missing information, and decide whether the call can continue with AI intake or must be escalated to a human operator. Operators are not passive observers. They focus on the most serious emergencies, take over any call when needed, and use a live Mapbox dashboard to see emergency hotspots, crowd surges, responder locations, and priority incidents.

The platform has three core modes:

1. **Normal Mode** — day-to-day emergency intake where operators may be busy, but there is no major surge.
2. **Disaster Mode** — earthquake/flood/fire/storm-style surge where many serious calls arrive at once.
3. **World Cup / Event Surge Mode** — stadium/fan-zone/tourist surge where multilingual visitors, crowds, transit disruption, medical incidents, lost people, and security issues increase call volume.

## 2.1 How Teammates and AI Coding Tools Should Use This Document

This file is written for both human teammates and AI coding tools such as Cursor, Codex, Claude/Opus, or other code-generation assistants. Treat it as the **source-of-truth product and architecture brief**.

When using an AI coding tool, give it this file together with `project_plan.md`. The model should use this file to understand **what the product is**, while `project_plan.md` explains **what to build and in what order**.

### Rules for AI-assisted implementation

- Do not invent a new product architecture.
- Do not replace the `Incident` and `CallSession` backbone.
- Do not create disconnected mock-only objects that cannot later plug into Supabase.
- Do not let frontend, backend, AI, and voice work evolve with different data shapes.
- Every feature should use shared TypeScript types from `/lib/types`.
- Every backend mutation should go through an API route or database helper.
- Every AI output must be validated before it changes state.
- Every major state change should produce an audit log.

### Build style expected from Cursor/Codex

The codebase should be built like a stable tower:

```text
shared contracts → database helpers → API routes → mock UI → AI runtime → voice integration → realtime/demo polish
```

Each layer should compile and keep working before the next layer is added. Later steps should extend earlier modules instead of rewriting them. For example, the Mapbox mock should use the real `Incident` type from the beginning, so when Supabase starts sending real incidents, the map does not need to be rebuilt.

### What “done” means for any module

A module is not considered done unless:

- it uses shared types;
- it has clear inputs/outputs;
- it handles missing/error states;
- it can be tested with mock data;
- it does not silently break existing demo flows;
- it fits the folder structure in this document.

## 3. Core Architecture Philosophy

The system is built around a controlled AI-agent architecture.

The AI agents are powerful enough to reason, request tools, and recommend actions, but they are not fully autonomous emergency dispatchers. The backend validates every action before anything changes in the system.

### Key rule

```text
AI agents reason and request actions.
The backend validates and executes actions.
Human operators remain in control.
```

### What the AI can do

- Interpret caller transcripts.
- Classify incident type and urgency.
- Detect missing information.
- Ask the next best question.
- Identify when a human operator is needed.
- Request safe backend tools such as geocoding or event-zone lookup.
- Recommend prioritization during surges.
- Produce structured incident patches.

### What the AI cannot do directly

- Write directly to the database.
- Directly dispatch real emergency resources.
- Directly control Twilio, Mapbox, Supabase, or operator assignment without backend validation.
- Make irreversible emergency decisions without human/backend control.

## 4. Core Software Stack

| Layer | Tool | Responsibility |
|---|---|---|
| Voice intake | ElevenLabs | AI voice agent, speech-to-text, text-to-speech, caller interaction |
| Telephony | Twilio | Demo phone number, SMS, call transfer to operator phone |
| AI reasoning | Featherless | Hosts selected open-weight LLM used inside controlled AI agents |
| Backend | Next.js API routes | Agent runtime, validation, orchestration, safe tool execution |
| Database | Supabase/PostgreSQL | Incidents, call sessions, transcript events, audit logs, realtime state |
| Realtime updates | Supabase Realtime | Push incident changes to dashboard |
| Map | Mapbox | Command map, pins, heatmaps, clusters, event layers, responder locations |
| Frontend | Next.js/React | Operator dashboard, incident queue, call controls, map UI |
| Optional dictation | Wispr Flow / WhisperFlow-style tools | Operator-side dictation and faster note entry |

## 5. High-Level Workflow

```text
Caller
  ↓
Twilio demo number
  ↓
ElevenLabs voice agent
  ↓
Final transcript event
  ↓
Next.js backend agent runtime
  ↓
Featherless-powered Call Triage Agent
  ↓
Backend executes safe tools + validates output
  ↓
Supabase/PostgreSQL updates Incident + CallSession
  ↓
Supabase Realtime updates dashboard
  ↓
Mapbox visualizes incident state
  ↓
Operator takes over, resolves, monitors, or escalates
```

## 6. Core MVP Agents

We are building two controlled AI agents for the MVP.

### 6.1 Call Triage Agent

The Call Triage Agent runs for each active call. It is powered by a Featherless-hosted LLM, but the backend controls execution.

Responsibilities:

- Understand the latest caller transcript.
- Use current Incident and CallSession state.
- Detect urgency and incident type.
- Request safe tools when needed, such as location lookup.
- Determine whether AI can continue or a human operator is needed.
- Produce a structured response for the backend.
- Generate the next question for ElevenLabs.

The Call Triage Agent should be capped to a small number of steps for reliability.

```text
Recommended MVP limit: max 2 model reasoning calls per transcript turn
```

### 6.2 Surge / GeoOps Agent

The Surge / GeoOps Agent runs across many incidents, mainly in Disaster Mode and World Cup/Event Surge Mode.

Responsibilities for MVP:

- Detect abnormal call volume.
- Group incidents into clusters.
- Identify hotspot zones.
- Rank incidents by priority.
- Recommend which calls operators should handle first.
- Recommend which calls can continue with AI intake.
- Generate cluster summaries for the dashboard.

Important boundary:

For the MVP, this agent should **not** perform full route optimization or real dispatch. It can recommend priority and highlight map regions. Full path optimization can be added later.

## 7. Full Workflow Example — Non-Emergency Call

Scenario:

```text
Caller says: “Someone stole my bike near Dana Porter Library.”
```

### Step 1 — Call starts

- Caller uses their real phone to call the Twilio demo number.
- Twilio routes the call to the ElevenLabs voice agent.
- Backend creates an empty Incident.
- Backend creates a CallSession linked to the Incident.

Initial Incident:

```json
{
  "urgency": "unknown",
  "incident_type": "unknown",
  "status": "active_call",
  "control_state": "ai_leading",
  "ai_active": true,
  "location": null,
  "coordinates": null,
  "summary": null,
  "collected_fields": {},
  "missing_fields": []
}
```

### Step 2 — Transcript arrives

ElevenLabs sends the backend a final transcript turn:

```text
Someone stole my bike near Dana Porter Library.
```

Partial transcripts may appear in the UI, but only final transcript turns trigger AI reasoning.

### Step 3 — Backend runs Call Triage Agent

The backend sends the agent:

- latest transcript;
- current Incident;
- current CallSession;
- mode = Normal Mode;
- allowed tools;
- schema instructions.

The agent reasons:

```text
This is likely a non-emergency theft report.
No immediate danger is reported.
Location is approximate and should be geocoded.
Need missing fields: bike description, time, suspect seen, contact info.
```

### Step 4 — Agent requests safe tools

The agent may request:

```json
{
  "tool_requests": [
    {
      "tool": "geocode_location",
      "args": {
        "location_text": "Dana Porter Library"
      }
    }
  ]
}
```

The backend executes the tool, not the LLM.

### Step 5 — Agent produces final structured output

```json
{
  "incident_patch": {
    "urgency": "non_emergency",
    "incident_type": "bike_theft",
    "operator_required": false,
    "status": "active_call",
    "location_status": "approximate_by_ai",
    "location": "near Dana Porter Library",
    "coordinates": {
      "lat": 43.4706,
      "lng": -80.5439
    },
    "summary": "Caller reports a stolen bike near Dana Porter Library. No immediate danger reported.",
    "collected_fields": {
      "item": "bike",
      "reported_location": "Dana Porter Library"
    },
    "missing_fields": [
      "bike_description",
      "time_of_theft",
      "suspect_seen",
      "caller_contact"
    ],
    "recommended_action": "Continue AI intake and collect non-emergency theft details."
  },
  "call_session_patch": {
    "ai_active": true,
    "should_escalate": false,
    "next_question": "Can you describe the bike and when it was stolen?"
  },
  "say_to_caller": "Can you describe the bike and when it was stolen?"
}
```

### Step 6 — Backend validates and updates state

- Backend validates the JSON schema.
- Backend merges safe fields into Supabase.
- Dashboard receives realtime update.
- Mapbox shows a lower-priority/non-emergency pin.
- ElevenLabs asks the next question.

### Step 7 — AI completes report

After collecting enough fields, the agent returns:

```json
{
  "incident_patch": {
    "status": "ai_handled",
    "control_state": "ai_completed",
    "ai_active": false,
    "missing_fields": [],
    "recommended_action": "Create non-emergency theft report."
  },
  "call_session_patch": {
    "status": "closed",
    "ai_active": false,
    "next_question": null
  },
  "say_to_caller": "Your report has been recorded. You will receive a reference number by SMS."
}
```

The backend can then trigger SMS:

```text
Report received. Ref: INC-2041. Location: near Dana Porter Library.
```

## 8. Full Workflow Example — Emergency Call

Scenario:

```text
Caller says: “Someone broke into my house.”
```

### Step 1 — Call starts

- Caller calls the Twilio demo number.
- ElevenLabs answers.
- Backend creates Incident + CallSession.
- Dashboard shows a new active AI-handled call.

### Step 2 — Transcript arrives

```text
Someone broke into my house.
```

### Step 3 — Backend runs Call Triage Agent

The agent determines:

```text
This is a critical active break-in.
Human operator is required.
Location is required before transfer if possible.
AI should ask location once, then transfer.
```

### Step 4 — Agent output after first turn

```json
{
  "incident_patch": {
    "urgency": "critical",
    "incident_type": "active_break_in",
    "operator_required": true,
    "status": "collecting_location",
    "control_state": "ai_location_collection",
    "ai_active": true,
    "summary": "Caller reports an active break-in.",
    "collected_fields": {
      "reported_emergency": "active break-in"
    },
    "missing_fields": [
      "location",
      "caller_safety",
      "injuries_reported",
      "suspect_location",
      "callback_number"
    ],
    "recommended_action": "Ask for exact location once, then transfer to human operator."
  },
  "call_session_patch": {
    "should_escalate": true,
    "next_question": "What is your exact location?"
  },
  "say_to_caller": "What is your exact location?"
}
```

### Step 5 — Dashboard updates immediately

The dashboard should show:

```text
Critical Call
Type: Active Break-In
Status: Collecting Location
AI Active: Yes
Operator Required: Yes
```

If the operator clicks **Take Over** before the location is collected:

- backend closes CallSession;
- `ai_active = false`;
- call transfer begins;
- dashboard shows `human_active`.

### Step 6 — Caller gives location

```text
I am at 123 King Street, apartment 804.
```

The agent requests geocoding:

```json
{
  "tool_requests": [
    {
      "tool": "geocode_location",
      "args": {
        "location_text": "123 King Street, apartment 804"
      }
    }
  ]
}
```

Backend geocodes the location and returns coordinates.

### Step 7 — Agent returns transfer decision

```json
{
  "incident_patch": {
    "urgency": "critical",
    "incident_type": "active_break_in",
    "status": "transferring_to_operator",
    "control_state": "transferring",
    "ai_active": true,
    "location_status": "confirmed_by_ai",
    "location": "123 King Street, Apartment 804",
    "coordinates": {
      "lat": 43.6532,
      "lng": -79.3832
    },
    "summary": "Caller reports an active break-in at 123 King Street, Apartment 804.",
    "recommended_action": "Transfer to human operator immediately."
  },
  "call_session_patch": {
    "should_escalate": true,
    "operator_transfer_status": "requested",
    "next_question": null
  },
  "system_actions": [
    {
      "action": "transfer_to_operator",
      "reason": "critical emergency with location collected"
    }
  ],
  "say_to_caller": "I have your location. I am connecting you to an operator now."
}
```

### Step 8 — Backend executes transfer

The backend, not the LLM, executes transfer through ElevenLabs/Twilio.

- Call transfers to teammate operator phone.
- Dashboard shows transfer state.
- Mapbox shows critical red pin.
- CallSession closes.
- AI stops.

Final state:

```json
{
  "incident_patch": {
    "status": "human_active",
    "control_state": "human_active",
    "ai_active": false,
    "assigned_operator": "OP-1"
  },
  "call_session_patch": {
    "status": "closed",
    "ai_active": false,
    "operator_transfer_status": "transferred"
  }
}
```

## 9. System Modes

### 9.1 Normal Mode

Normal Mode is for regular intake when there is no major surge.

Behavior:

- AI answers incoming calls.
- AI handles non-emergency/low-priority reports end-to-end.
- AI escalates urgent/critical calls to operators.
- Operators can take over any active AI call.
- Mapbox still shows incident pins and responder locations.

Examples:

- stolen bike;
- lost laptop;
- noise complaint;
- suspicious but not immediately dangerous situation;
- urgent medical/police/fire call requiring escalation.

### 9.2 Disaster Mode

Disaster Mode is for major emergency surges.

Behavior:

- Many serious calls arrive at once.
- AI voice agents continue collecting information from callers not yet connected to operators.
- Operators prioritize the most life-threatening cases.
- Surge / GeoOps Agent clusters incidents and ranks priorities.
- Mapbox shows heatmaps, clusters, impact zones, blocked roads, responder locations, and critical pins.

Demo behavior:

- 1 real phone call through Twilio + ElevenLabs.
- 29 simulated transcript calls that bypass voice but still enter backend → AI agent → Supabase → Mapbox.

### 9.3 World Cup / Event Surge Mode

World Cup Mode is similar to Disaster Mode but tuned for stadium/fan-zone/tourist incidents.

Behavior:

- Multilingual caller support across all modes.
- Event-specific Mapbox layers are shown.
- Mock stadium/fan-zone infrastructure appears on the map.
- AI triages medical, safety, lost person, theft, crowd, and transit-related calls.
- Operators see hotspots around gates, fan zones, transit stations, and crowd-density areas.

Mock event layers can include:

- stadium perimeter;
- fan zone polygons;
- medical tents;
- police/security tents;
- lost tourist guidance points;
- lost-and-found centers;
- restricted vehicle zones;
- high-density crowd zones;
- transit stations;
- road closures;
- event staff posts.

## 10. Frontend Architecture

The frontend should be organized around reusable components and stable shared types.

Recommended structure:

```text
/app/dashboard/page.tsx
/components/dashboard/DashboardShell.tsx
/components/dashboard/TopBar.tsx
/components/dashboard/ModeSwitcher.tsx
/components/incidents/IncidentQueue.tsx
/components/incidents/IncidentCard.tsx
/components/incidents/IncidentDrawer.tsx
/components/incidents/MissingFieldsChecklist.tsx
/components/map/CommandMap.tsx
/components/map/MapLayerControls.tsx
/components/map/ResponderLayer.tsx
/components/map/EventLayer.tsx
/components/map/HeatmapLayer.tsx
/components/map/ClusterLayer.tsx
/components/operators/OperatorPanel.tsx
/components/voice/LiveTranscriptPanel.tsx
/components/voice/CallControlPanel.tsx
/lib/types/*.ts
```

### Main dashboard layout

```text
Top bar: mode, active calls, critical count, operator load
Left panel: incident queue, clusters, filters
Center: Mapbox command map
Right drawer: selected incident / cluster / operator details
Bottom or side panel: live transcript and call controls
```

### Mapbox layers

All modes:

- incident pins;
- responder locations;
- selected incident highlight;
- operator-selected route lines if mocked;
- incident clustering if many points exist.

Disaster Mode:

- heatmaps;
- disaster impact zones;
- blocked roads;
- structural/fire/medical clusters;
- responder staging areas.

World Cup Mode:

- stadium perimeter;
- fan zones;
- medical tents;
- police/security tents;
- lost-and-found points;
- high-density crowd zones;
- restricted vehicle zones;
- transit disruption markers.

## 11. Backend Architecture

The backend should be treated as the system orchestrator and agent runtime.

Recommended structure:

```text
/app/api/call/start/route.ts
/app/api/call/turn/route.ts
/app/api/call/end/route.ts
/app/api/operator/takeover/route.ts
/app/api/operator/update-incident/route.ts
/app/api/simulate/disaster/route.ts
/app/api/simulate/world-cup/route.ts
/app/api/surge/analyze/route.ts
/app/api/responders/mock/route.ts
/app/api/twilio/webhook/route.ts
/app/api/elevenlabs/webhook/route.ts
/lib/ai/featherlessClient.ts
/lib/ai/agents/callTriageAgent.ts
/lib/ai/agents/surgeGeoOpsAgent.ts
/lib/ai/prompts/*.ts
/lib/ai/schemas/*.ts
/lib/tools/geocodeLocation.ts
/lib/tools/eventZoneLookup.ts
/lib/tools/responderLookup.ts
/lib/tools/smsDraft.ts
/lib/db/supabase.ts
/lib/db/incidents.ts
/lib/db/callSessions.ts
/lib/voice/twilio.ts
/lib/voice/elevenlabs.ts
/lib/validation/*.ts
```

### Backend responsibilities

- Receive final transcript events.
- Create Incident and CallSession.
- Load current state.
- Run controlled AI-agent loop.
- Execute safe backend tools.
- Validate all LLM outputs.
- Merge patches into database.
- Trigger SMS/transfer through controlled functions.
- Provide mock simulation endpoints.
- Push updates through Supabase Realtime.
- Keep audit logs.

## 12. Database Schema

### 12.1 incidents

Permanent source of truth.

```sql
create table incidents (
  id uuid primary key default gen_random_uuid(),
  public_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  mode text not null default 'normal',
  urgency text not null default 'unknown',
  incident_type text not null default 'unknown',
  status text not null default 'active_call',

  operator_required boolean,
  assigned_operator text,
  control_state text not null default 'ai_leading',
  ai_active boolean not null default true,

  location_status text not null default 'unknown',
  location_confidence numeric,
  location text,
  coordinates jsonb,

  summary text,
  collected_fields jsonb not null default '{}'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  custom_fields jsonb not null default '[]'::jsonb,
  recommended_action text,

  priority_score numeric,
  cluster_id text,

  transcript_url text,
  audio_url text,
  last_updated_by text not null default 'system'
);
```

### 12.2 call_sessions

Temporary AI conversation state.

```sql
create table call_sessions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references incidents(id) on delete cascade,

  twilio_call_sid text,
  elevenlabs_conversation_id text,

  status text not null default 'active',
  ai_active boolean not null default true,
  turn_count integer not null default 0,

  recent_transcript jsonb not null default '[]'::jsonb,
  required_fields jsonb not null default '[]'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  next_question text,

  last_model_confidence numeric,
  should_escalate boolean not null default false,
  operator_transfer_status text not null default 'not_requested',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 12.3 transcript_events

```sql
create table transcript_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references incidents(id) on delete cascade,
  call_session_id uuid references call_sessions(id) on delete cascade,
  speaker text not null,
  text text not null,
  is_final boolean not null default true,
  language text,
  translated_text text,
  created_at timestamptz default now()
);
```

### 12.4 audit_logs

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references incidents(id) on delete cascade,
  actor text not null,
  action text not null,
  patch jsonb,
  created_at timestamptz default now()
);
```

### 12.5 responders

For MVP, responders can be fake/mock data loaded from JSON, CSV, or an API route.

```sql
create table responders (
  id text primary key,
  type text not null,
  status text not null,
  display_name text not null,
  coordinates jsonb not null,
  assigned_incident_id uuid,
  updated_at timestamptz default now()
);
```

### 12.6 event_layers

For World Cup mock layers.

```sql
create table event_layers (
  id text primary key,
  mode text not null,
  layer_type text not null,
  name text not null,
  geometry jsonb not null,
  metadata jsonb not null default '{}'::jsonb
);
```

## 13. Backend API Endpoints

### POST /api/call/start

Creates Incident and CallSession.

Input:

```json
{
  "mode": "normal",
  "twilio_call_sid": "CAxxxx",
  "elevenlabs_conversation_id": "ELxxxx"
}
```

Output:

```json
{
  "incident_id": "...",
  "call_session_id": "..."
}
```

### POST /api/call/turn

Processes one final transcript turn.

Input:

```json
{
  "incident_id": "...",
  "call_session_id": "...",
  "speaker": "caller",
  "text": "Someone stole my bike near Dana Porter Library.",
  "is_final": true
}
```

Output:

```json
{
  "say_to_caller": "Can you describe the bike and when it was stolen?",
  "incident": {},
  "call_session": {},
  "actions": []
}
```

### POST /api/operator/takeover

Operator manually takes over a call.

Input:

```json
{
  "incident_id": "...",
  "operator_id": "OP-1"
}
```

Effect:

- close CallSession;
- set Incident `status = human_active`;
- set `ai_active = false`;
- begin transfer if active phone call exists.

### POST /api/simulate/disaster

Creates simulated disaster calls and processes them in controlled batches.

### POST /api/simulate/world-cup

Creates simulated World Cup/event surge calls.

### GET /api/responders/mock

Returns fake responder location data for map visualization.

## 14. Featherless / LLM Agent Output Schema

The backend should require strict JSON.

```json
{
  "tool_requests": [
    {
      "tool": "geocode_location",
      "args": {
        "location_text": "string"
      },
      "reason": "string"
    }
  ],
  "incident_patch": {
    "mode": "normal | disaster | world_cup",
    "urgency": "unknown | non_emergency | urgent | critical",
    "incident_type": "string",
    "status": "string",
    "operator_required": true,
    "control_state": "string",
    "ai_active": true,
    "location_status": "unknown | approximate_by_ai | confirmed_by_ai | confirmed_by_operator",
    "location_confidence": 0.0,
    "location": "string",
    "coordinates": {
      "lat": 0.0,
      "lng": 0.0
    },
    "summary": "string",
    "collected_fields": {},
    "missing_fields": [],
    "recommended_action": "string",
    "priority_score": 0.0,
    "cluster_id": "string"
  },
  "call_session_patch": {
    "status": "active | closed",
    "ai_active": true,
    "turn_count": 1,
    "next_question": "string",
    "last_model_confidence": 0.0,
    "should_escalate": false,
    "operator_transfer_status": "not_requested | requested | transferred"
  },
  "system_actions": [
    {
      "action": "transfer_to_operator | send_sms | close_call_session | none",
      "args": {},
      "reason": "string"
    }
  ],
  "say_to_caller": "string"
}
```

Validation rules:

- Unknown tools are rejected.
- Direct DB writes are impossible.
- Unsafe fields are ignored.
- Emergency transfer requires backend validation.
- If JSON parsing fails, use a fallback question or escalate.
- AI output must be logged in audit_logs.

## 15. Agent Runtime Design

Recommended MVP loop:

```text
1. Backend receives final transcript.
2. Backend loads Incident + CallSession.
3. Backend calls Featherless with transcript + state.
4. Featherless returns tool_requests and/or draft patch.
5. Backend validates tool requests.
6. Backend executes safe tools.
7. Backend sends tool results back to Featherless if needed.
8. Featherless returns final structured output.
9. Backend validates final JSON.
10. Backend writes safe updates to Supabase.
11. Dashboard updates through Supabase Realtime.
12. Backend returns next phrase to ElevenLabs.
```

Keep the loop bounded:

```text
maxAgentSteps = 2 for call triage
maxAgentSteps = 1 or 2 for surge analysis
```

## 16. Voice Agent Implementation

### Demo call flow

```text
Your real phone
  ↓ calls
Twilio demo number
  ↓ routes to
ElevenLabs AI voice agent
  ↓ sends final transcripts to
Next.js backend
  ↓ escalates through
Twilio/ElevenLabs transfer to teammate operator phone
```

### Numbers

- Caller phone: your real phone.
- Caller-facing number: Twilio demo number.
- Operator destination: teammate phone number.

### Required voice behavior

- Respond quickly.
- Do not wait 30 seconds between turns.
- Process final transcript turns only.
- Keep questions short.
- For emergencies, ask location once, then transfer.
- For non-emergencies, collect missing fields and complete report.

### Transcript strategy

MVP:

- Use ElevenLabs transcript events if available.
- Store final transcript turns in `transcript_events`.
- Show near-live transcript in dashboard.

Stretch:

- Use Twilio Media Streams or another real-time STT provider for lower-latency transcript streaming.

### Audio playback strategy

MVP recommendation:

- Do not build live audio playback first.
- Prioritize live transcript.
- Add post-call recording/audio URL only if easy.

Reason:

- Live audio streaming into the dashboard adds complexity.
- Transcript is more valuable for operator situational awareness during the hackathon.

## 17. SMS Behavior

SMS should exist across all modes.

Possible SMS examples:

Normal:

```text
Report received. Ref: INC-2041. Summary: stolen bike near Dana Porter Library.
```

Emergency:

```text
Emergency report received. Ref: INC-3021. Stay on the line if possible. Your location has been recorded.
```

World Cup:

```text
Report received. Ref: WC-1042. Nearest help point: Gate 3 Info Tent.
```

SMS should not replace trained emergency instructions. Keep it short and factual.

## 18. Mapbox Dashboard Design

### Core Mapbox elements

- Incident pins by urgency.
- Heatmap overlays.
- Cluster circles.
- Responder vehicles.
- Blocked roads.
- Event-specific layers.
- Impact zones.
- Selected incident drawer.
- Cluster drawer.
- Layer toggles.

### Responder mock data

Use a fake endpoint or spreadsheet-backed JSON:

```text
/api/responders/mock
```

Example responder:

```json
{
  "id": "EMS-2",
  "type": "ambulance",
  "status": "available",
  "display_name": "EMS Unit 2",
  "coordinates": {
    "lat": 43.641,
    "lng": -79.389
  }
}
```

All modes should show responder locations.

Disaster and World Cup modes should eventually support AI-assisted route/path recommendations, but this should not be a first build target.

## 19. Parallel Team Structure

The team has 4 people. Work should be parallelized around stable contracts so nobody waits for one person too long.

### Shared foundation first

All teammates should agree on:

- Incident type;
- CallSession type;
- API request/response contracts;
- folder structure;
- Supabase schema;
- mode enum;
- AI output schema.

### Team Member 1 — Fullstack / Integration Lead

Owns:

- repository structure;
- shared types;
- dashboard shell;
- Supabase client;
- integration checks;
- deployment readiness.

### Team Member 2 — Voice + Telephony

Owns:

- Twilio number;
- ElevenLabs agent;
- transcript webhook;
- transfer to operator;
- SMS sending.

### Team Member 3 — AI Agent Pipeline

Owns:

- Featherless client;
- Call Triage Agent;
- Surge / GeoOps Agent;
- prompt files;
- output schemas;
- tool request validation.

### Team Member 4 — Mapbox + Dashboard UX

Owns:

- Mapbox command map;
- mock incidents;
- layers;
- responder visualization;
- incident drawer;
- cluster drawer.

## 20. System Design Rules

To prevent fragile code, build in layers.

### Rule 1 — Contracts first

Build shared TypeScript types before feature work.

### Rule 2 — Database shape first

Do not build UI components around fake random objects that do not match the Incident schema.

### Rule 3 — All model outputs validated

Use Zod or equivalent schema validation.

### Rule 4 — Backend owns state

Frontend should not directly mutate critical incident fields without an API route.

### Rule 5 — Add features behind mode/layer toggles

World Cup layers should not break Disaster Mode.

### Rule 6 — Mock data must use real schemas

Simulated disaster and World Cup calls should create real Incident objects.

### Rule 7 — Keep agent loops bounded

No unbounded loops. No infinite tool calls.

### Rule 8 — Audit everything important

Every AI patch, operator takeover, transfer, and status change should create an audit log.

## 21. Containerization / Project Stability

The project should be easy for teammates to run.

Recommended baseline:

- `.env.example` with all required variables.
- `README.md` setup instructions.
- `npm run dev` works locally.
- shared types compile before feature work.
- Supabase migration files committed.
- optional Dockerfile for app deployment.

Possible Docker setup:

```text
Dockerfile
.dockerignore
docker-compose.yml
```

For hackathon speed, do not over-invest in Docker if Vercel + Supabase works quickly. But keep the code modular enough that containerization is possible.

## 22. Future Features If Time Allows

These ideas are useful, but they should not be built before the core pipeline works.

### 22.1 RAG for event/disaster context

Use retrieval to inject relevant venue, disaster, road closure, shelter, or SOP context before calling the AI agent.

Example:

```text
Caller says they are near Gate 3.
Backend retrieves Gate 3 metadata, nearest medical tent, nearest security tent, and restricted vehicle zone.
AI uses that context in its response.
```

### 22.2 Mapbox MCP / Natural-language GeoOps

Let operators ask questions like:

```text
Which critical calls are closest to EMS?
Which incidents are inside the crowd hotspot?
Which blocked road affects the fastest route?
```

This should be stretch only.

### 22.3 AI-assisted responder routing

Use an agent to recommend routes or responder assignments based on:

- incident priority;
- responder location;
- blocked roads;
- crowd zones;
- ETA;
- cluster severity.

Do not implement first. Mock route lines are enough early.

### 22.4 Tourist navigation support

World Cup/event mode could eventually direct tourists to:

- medical tents;
- lost-and-found;
- police/security booths;
- tourist guidance points;
- nearest transit exit.

This could use Mapbox + RAG + AI agents later.

### 22.5 Audio playback

Add post-call recordings to the incident drawer if easy. Live audio streaming should be stretch.

### 22.6 Operator-side dictation

Use Wispr Flow / WhisperFlow-style dictation so operators can fill notes faster while handling transferred calls.

### 22.7 Emotional tone adaptation

Detect caller stress/crying/panic from transcript or voice metadata and adjust ElevenLabs tone to be calmer, shorter, and more reassuring.

Do not overbuild this first.
