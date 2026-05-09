# Featherless Old vs New Architecture

## Purpose

This document explains how the project is evolving from a simple AI triage flow to a more useful Featherless-powered, tool-using emergency operations architecture.

This is not a rewrite. It is an upgrade path that preserves the current MVP while making the agents more operationally useful.

---

## Old / Current Way

The current system uses the AI model mostly as a structured transcript classifier.

```text
Transcript
→ AI triage agent
→ validated JSON
→ Incident patch
→ CallSession patch
→ backend updates state
→ dashboard visualizes incident
```

Current output shape:

```text
tool_requests
incident_patch
call_session_patch
system_actions
say_to_caller
```

Current provider approach:

```text
mock        = deterministic fallback
gemma       = current real AI testing provider
featherless = future provider once API access is ready
```

## What the old way does well

```text
- classifies emergency vs non-emergency
- extracts incident type
- updates urgency/status
- tracks missing fields
- returns next caller question
- supports fallback behavior
- keeps backend in control
```

## What the old way lacks

```text
- limited geospatial reasoning
- no real routing/travel-time recommendations
- no nearest help-point lookup
- no event-zone understanding beyond static prompt context
- no real responder proximity reasoning
- no structured tool result loop
- weak disaster/world-cup operational intelligence
```

It is safe, but not yet as impressive or useful as it could be.

---

## New Way

The new architecture turns Featherless into a controlled tool-using reasoning layer.

```text
Transcript + current state
→ Featherless first pass
→ structured tool_requests
→ backend validates requests
→ backend executes safe tools
→ tool_results
→ Featherless second pass
→ final structured output
→ backend validates
→ database update
→ dashboard visualizes
```

The AI can request tools, but the backend decides what is allowed.

---

## Why This Is Better

The new architecture lets the agent do useful work like:

```text
- geocode caller location
- reverse-geocode coordinates
- find nearest medical tent
- find nearest lost-and-found center
- identify whether caller is inside a fan zone or restricted area
- estimate route/travel time
- compare responder proximity
- summarize clusters and hotspots
- draft SMS summaries/directions
- handle multilingual caller context
```

This makes the demo more than “AI summarizes calls.”

It becomes:

```text
AI emergency operations assistant
+ controlled backend tools
+ Mapbox geospatial intelligence
+ operator-facing dashboard
```

---

## Old vs New Comparison

| Area | Old Way | New Way |
|---|---|---|
| AI role | Classify transcript and patch incident | Reason, request tools, interpret tool results, produce final validated recommendation |
| Tool use | Mostly empty or proposed only | Backend-executed safe tools |
| Mapbox | Dashboard visualization only | Backend geospatial tools + dashboard visualization |
| Featherless | Future model provider | Primary reasoning layer when available |
| Disaster mode | Mock transcripts and dashboard layers | Cluster/resource/route-aware GeoOps reasoning |
| World Cup mode | Mock event layers | Event-zone and nearest-help-point intelligence |
| SMS | Operator/manual or stub | AI can draft factual SMS; backend/operator decides send |
| Safety | Backend validates patches | Backend validates tool requests and patches |
| Dashboard | Shows incident fields | Shows incident fields + recommendations/tool outputs |

---

## Important Safety Boundary

The new architecture still follows:

```text
AI reasons.
Backend validates.
Backend executes.
Operator can override.
```

The AI must not directly:

```text
- write to Supabase
- dispatch responders
- call Twilio
- control ElevenLabs
- call Mapbox MCP freely
- mutate dashboard state
- send SMS without backend/operator validation
```

---

## Example: Normal Mode

Caller:

```text
Someone stole my bike near Dana Porter Library.
```

Old way:

```text
AI classifies bike_theft
AI marks non_emergency
AI asks for bike description
```

New way:

```text
AI classifies bike_theft
AI requests geocode_location("Dana Porter Library")
Backend validates and geocodes
AI receives location result
AI updates incident with coordinates/confidence
AI asks for bike description and time of theft
AI drafts optional SMS reference after report completion
```

---

## Example: Disaster Mode

Caller:

```text
I'm trapped near a collapsed parking structure. Roads are blocked.
```

Old way:

```text
AI marks critical
AI asks for location
Dashboard shows critical incident
```

New way:

```text
AI marks critical
AI requests geocode_location
Backend checks nearby blocked roads / impact zones
AI requests responder_lookup / route_between_points
Backend returns route/resource context
AI recommends operator takeover and nearest available responder path
Dashboard shows incident, blocked road context, route line, and priority
```

---

## Example: World Cup Mode

Caller:

```text
I'm near Gate 3 and my child is missing.
```

Old way:

```text
AI classifies missing person / urgent
Dashboard shows World Cup incident
```

New way:

```text
AI detects language and event context
AI requests event_zone_lookup("Gate 3")
AI requests nearest_help_point_lookup(type: lost_and_found/security)
Backend returns nearest help points and coordinates
AI escalates if child is at risk
Dashboard shows event zone, nearest help point, and recommended action
SMS can summarize where to go or reference ID
```

---

## RAG-Lite Role

The old way depends mostly on the prompt and transcript.

The new way should load a small context pack before reasoning:

```text
mode
incident type
nearby event zones
nearby help points
nearby responders
blocked roads
relevant SOP snippets
SMS templates
```

This is enough for the hackathon. A full vector database can come later.

---

## What Needs To Be Built

## Member 1

```text
- safe tool registry
- Mapbox MCP backend wrapper
- mock fallback tools
- ToolResult normalization
- audit logs
- future /api/surge/analyze
```

## Member 3

```text
- Featherless provider wrapper
- controlled agent runtime
- tool request schema
- tool result reasoning pass
- Call Triage Agent v2
- Surge / GeoOps Agent
```

## Member 4

```text
- route line visualization
- help-point display
- event-zone matches
- responder recommendations
- tool status/confidence UI
- cluster/priority displays
```

---

## Compatibility With Current MVP

The current MVP should continue working with:

```text
AI_PROVIDER=mock
GET /api/dev/incidents
POST /api/operator/*
POST /api/simulate/*
GET /api/responders/mock
```

The new architecture should be added behind interfaces and typed contracts so existing demo flows do not break.

---

## One-Sentence Pitch

Old version:

```text
AI summarizes and classifies calls.
```

New version:

```text
Featherless agents reason over calls, request safe geospatial/context tools, and help operators prioritize, route, and resolve incidents while the backend validates every action.
```
