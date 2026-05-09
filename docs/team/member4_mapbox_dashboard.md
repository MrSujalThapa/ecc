# Member 4 — Mapbox + Dashboard UX Plan

## Role Summary

You are **Team Member 4: Mapbox + Dashboard UX**.

Your goal is to make the product visually impressive, operationally clear, and demo-ready. The dashboard should feel like a real emergency command center where operators can see incoming incidents, urgency, responder locations, AI triage state, disaster clusters, World Cup/event layers, and operator actions.

You own:

- Mapbox command map
- Dashboard shell
- Incident visualization
- Disaster layers
- World Cup / event layers
- Responder visualization
- Incident queue
- Incident drawer
- Cluster drawer
- Map layer controls
- Demo controls
- Realtime dashboard connection once Supabase Realtime is ready
- Final UI/demo polish

The dashboard must use the shared project contracts so backend data can replace mock/fallback data without a frontend rewrite.

---

## Current Situation

Member 1 has completed the initial fullstack integration layer. This changes the Member 4 approach from **mock-only first** to **shared-types + API-ready dashboard**.

You should still build in layers, but you no longer need to invent temporary dashboard-only types.

### Available now

Use these existing project pieces:

- Shared domain types from `/lib/types`
- API contracts from `docs/api_contracts.md`
- API TypeScript types from `/lib/types/api.ts`
- Core call endpoints:
  - `POST /api/call/start`
  - `POST /api/call/turn`
  - `POST /api/call/end`
- Operator endpoints:
  - `POST /api/operator/takeover`
  - `POST /api/operator/update-incident`
  - `POST /api/operator/resolve`
  - `POST /api/operator/send-sms`
- Simulation endpoints:
  - `POST /api/simulate/disaster`
  - `POST /api/simulate/world-cup`
- Responder endpoint:
  - `GET /api/responders/mock`
- Dev incident endpoint:
  - `GET /api/dev/incidents`
- Dev persistence endpoint:
  - `GET /api/dev/persistence`
- Dev voice simulator:
  - `/dev/voice-sim`

### Not available yet

Do not depend on these yet:

- Supabase Realtime subscriptions in the frontend
- `POST /api/surge/analyze`
- Real Twilio webhook ingestion
- Real ElevenLabs webhook ingestion
- Real call transfer
- Real SMS sending
- Production Featherless integration
- Production geocoding/tool execution

---

## Local Testing Setup

You already have the Mapbox token configured in `.env.local`.

Minimum `.env.local` for Member 4 dashboard development:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=your_existing_mapbox_token_here
AI_PROVIDER=mock
```

Do **not** commit `.env.local`.

For current local Member 4 development, you do **not** need these yet:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMMA_API_KEY=
FEATHERLESS_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
ELEVENLABS_API_KEY=
```

The backend should fall back to in-memory demo storage if Supabase service-role env vars are missing.

For local development, prefer:

- `AI_PROVIDER=mock`
- `/api/dev/incidents` for incident list
- `/api/responders/mock` for responders
- `/api/simulate/disaster` for disaster demo data
- `/api/simulate/world-cup` for event demo data
- `/api/operator/*` for operator actions

Do not require Supabase Realtime for the first dashboard version.

Do not require real Twilio, ElevenLabs, Gemma, Featherless, Supabase, or SMS integrations for Member 4 UI work.

---

## Required Reading Before Coding

Read these files before asking Cursor/Codex/Claude to implement your work:

```text
docs/project_details.md
docs/project_plan.md
docs/api_contracts.md
docs/team/member1_fullstack_integration.md
docs/team/member4_mapbox_dashboard.md
```

For every Cursor prompt, include:

```text
I am Team Member 4: Mapbox + Dashboard UX.
Use docs/project_details.md, docs/project_plan.md, docs/api_contracts.md, docs/team/member1_fullstack_integration.md, and docs/team/member4_mapbox_dashboard.md as source-of-truth.
Preserve shared contracts and do not rewrite unrelated code.
```

For Mapbox-specific edits, use the installed Mapbox skills and Mapbox DevKit MCP when API behavior, sources/layers, style expressions, token security, validation, or performance are uncertain.

---

## Key Rules

### Contract rules

- Use shared types from `/lib/types`.
- Do not create duplicate dashboard-only versions of:
  - `Incident`
  - `CallSession`
  - `TranscriptEvent`
  - `Responder`
  - `EventLayer`
  - `SurgeCluster`
- Use `docs/api_contracts.md` as the HTTP shape contract.
- Mock/fallback data must match the real schema.
- If a shared type or API contract looks wrong, ask before changing it.

### State mutation rules

- Dashboard buttons should call API routes instead of mutating critical state only in React.
- Frontend should not directly mutate critical incident fields.
- Important operator actions should go through `/api/operator/*`.
- After operator/simulation actions, refetch incidents.

### Integration rules

- `POST /api/operator/send-sms` exists but may currently be a stub.
- Supabase Realtime is not implemented in the frontend yet, so use fetch/refetch first.
- `POST /api/surge/analyze` is not implemented yet, so cluster and surge intelligence UI should use mock/frontend-derived clusters for now.
- Do not call AI directly from the dashboard.
- Consume existing API routes and shared types; do not modify backend, API, AI, voice, Supabase, validation, migrations, or shared contracts unless explicitly assigned.

### Check rules

- Run full `npm run lint` when practical.
- If full lint fails because of unrelated pre-existing files, run targeted lint/checks on changed files and document both the full-lint failure and targeted result.

---

## Do Not Touch Unless Asked

Avoid modifying these areas unless the team explicitly asks:

```text
/lib/ai/*
/lib/voice/*
/lib/db/*
/lib/server/*
/lib/supabase/*
/lib/validation/*
/app/api/*
/app/api/call/*
/app/api/operator/*
/app/api/twilio/*
/app/api/elevenlabs/*
/app/api/surge/*
supabase/migrations/*
```

You may consume API routes and shared types, but your main job is dashboard/map UX.

---

## Main Files You Own

Recommended implementation locations:

```text
/app/dashboard/page.tsx

/components/dashboard/DashboardShell.tsx
/components/dashboard/TopBar.tsx
/components/dashboard/ModeSwitcher.tsx
/components/dashboard/DemoControls.tsx
/components/dashboard/StatusMetrics.tsx
/components/dashboard/OperatorLoadPanel.tsx

/components/incidents/IncidentQueue.tsx
/components/incidents/IncidentCard.tsx
/components/incidents/IncidentDrawer.tsx
/components/incidents/MissingFieldsChecklist.tsx
/components/incidents/ClusterDrawer.tsx
/components/incidents/ClusterIncidentList.tsx

/components/map/CommandMap.tsx
/components/map/MapLayerControls.tsx
/components/map/ResponderLayer.tsx
/components/map/EventLayer.tsx
/components/map/HeatmapLayer.tsx
/components/map/ClusterLayer.tsx

/components/voice/LiveTranscriptPanel.tsx
/components/voice/CallControlPanel.tsx

/lib/mock/dashboardFallbackData.ts
/lib/mock/incidents.ts
/lib/mock/responders.ts
/lib/mock/disasterLayers.ts
/lib/mock/worldCupLayers.ts
/lib/mock/clusters.ts
/lib/mock/transcripts.ts

/lib/map/incidentStyling.ts
/lib/map/geojson.ts
/lib/map/layers.ts
/lib/map/clustering.ts

/lib/data/incidentDataSource.ts
/lib/data/mockIncidentDataSource.ts
/lib/data/apiIncidentDataSource.ts
/lib/data/supabaseIncidentDataSource.ts
/lib/data/operatorActions.ts
/lib/data/mockOperatorActions.ts
/lib/data/apiOperatorActions.ts
/lib/data/respondersClient.ts
/lib/data/simulationClient.ts
/lib/data/supabaseTranscriptDataSource.ts
```

---

## Core Architecture Pattern For Your Work

Do not build UI components that directly depend on Supabase or backend implementation details.

Use this pattern:

```text
UI components
  -> typed data/action adapters
  -> local API/fallback implementation now
  -> Supabase/API/realtime implementation later
```

This lets you build immediately while teammates continue backend, voice, and AI work.

### Incident data source shape

```ts
export type IncidentDataSource = {
  getInitialIncidents(): Promise<Incident[]>;
  refreshIncidents(): Promise<Incident[]>;
  subscribeToIncidents?(
    onChange: (incidents: Incident[]) => void,
    onError?: (error: Error) => void
  ): () => void;
};
```

### First-pass API/fallback implementation

```ts
export const apiIncidentDataSource: IncidentDataSource = {
  async getInitialIncidents() {
    const response = await fetch("/api/dev/incidents");
    if (!response.ok) {
      return dashboardFallbackIncidents;
    }

    const data = await response.json();

    if (!data.incidents || data.incidents.length === 0) {
      return dashboardFallbackIncidents;
    }

    return data.incidents;
  },

  async refreshIncidents() {
    return this.getInitialIncidents();
  },
};
```

### Later realtime implementation

```ts
export const supabaseIncidentDataSource: IncidentDataSource = {
  async getInitialIncidents() {
    // Load from Supabase or API.
  },

  async refreshIncidents() {
    // Refetch current state.
  },

  subscribeToIncidents(onChange, onError) {
    // Subscribe through Supabase Realtime.
    return () => {
      // Unsubscribe.
    };
  },
};
```

### Operator actions shape

```ts
export type OperatorActions = {
  takeOverIncident(incidentId: string, operatorId: string): Promise<void>;
  updateIncident(incidentId: string, patch: Record<string, unknown>): Promise<void>;
  resolveIncident(incidentId: string, operatorId: string): Promise<void>;
  sendSms(incidentId: string): Promise<void>;
};
```

---

# Build Order

Recommended future order after Phase 1:

1. Phase 2: Data/Action Adapters
2. Phase 3: Incident Queue + Incident Drawer UX
3. Phase 9: API Operator Actions
4. Phase 8: Demo Controls + Simulation Buttons
5. Phase 4: Responder Visualization + Layer Controls
6. Phase 5: Disaster Mode Layers
7. Phase 6: Cluster Drawer
8. Phase 7: World Cup / Event Surge Layers
9. Phase 10: Realtime later
10. ~~Phase 11: Final Demo Polish~~

Phase 9 may be small if Phase 2/3 already wire most operator actions, but keep it as the hardening pass for API action loading, error, and refetch behavior.

## Phase 1 — Dashboard Shell + Core Mapbox — Completed

~~Start this immediately. Do not wait for more backend work.~~

### Build

```text
/app/dashboard/page.tsx
/components/dashboard/DashboardShell.tsx
/components/dashboard/TopBar.tsx
/components/dashboard/ModeSwitcher.tsx
/components/map/CommandMap.tsx
/components/incidents/IncidentQueue.tsx
/components/incidents/IncidentDrawer.tsx
/lib/map/incidentStyling.ts
/lib/mock/dashboardFallbackData.ts
```

### Requirements

- ~~Create `/dashboard` route.~~
- ~~Add top bar, left incident queue, center Mapbox command map, and right drawer.~~
- ~~Use existing shared `Incident` type from `/lib/types`.~~
- ~~Fetch incidents from `/api/dev/incidents`.~~
- ~~If no incidents exist or fetch fails, use fallback demo incidents from `/lib/mock/dashboardFallbackData.ts`.~~
- ~~Render incident pins on Mapbox.~~
- ~~Pin styling should be based on urgency.~~
- ~~Clicking a queue item selects the incident.~~
- ~~Clicking a map pin selects the incident.~~
- ~~The selected incident should appear in the drawer.~~
- ~~Do not use Mapbox popups as the main UI; use the side drawer.~~
- ~~Handle loading, empty, and error states.~~
- ~~Keep `npm run dev` working.~~

### Cursor prompt

```text
I am Team Member 4: Mapbox + Dashboard UX.

Build Phase 1: dashboard shell and core Mapbox dashboard.

Read:
- docs/project_details.md
- docs/project_plan.md
- docs/api_contracts.md
- docs/team/member1_fullstack_integration.md
- docs/team/member4_mapbox_dashboard.md

I already have NEXT_PUBLIC_MAPBOX_TOKEN in .env.local.
I do not have Supabase, Twilio, ElevenLabs, Gemma, or Featherless keys yet.
Use AI_PROVIDER=mock and local backend fallback paths.

Create or update:
- /app/dashboard/page.tsx
- /components/dashboard/DashboardShell.tsx
- /components/dashboard/TopBar.tsx
- /components/dashboard/ModeSwitcher.tsx
- /components/map/CommandMap.tsx
- /components/incidents/IncidentQueue.tsx
- /components/incidents/IncidentDrawer.tsx
- /lib/map/incidentStyling.ts
- /lib/mock/dashboardFallbackData.ts

Requirements:
- Use existing shared types from /lib/types.
- Do not create duplicate dashboard-only types.
- Fetch incidents from GET /api/dev/incidents.
- If that endpoint is unavailable or empty, use schema-compatible fallback incidents.
- Render a Mapbox command map centered on Toronto.
- Render incident pins by urgency.
- Clicking a queue item or map pin selects the incident.
- Display selected incident details in the right drawer.
- Do not create random fake data shapes.
- Do not touch AI, voice, Twilio, Featherless, Supabase migrations, or backend orchestration.
- Keep npm run dev working.
```

---

## Phase 2 — Data/Action Adapters — Completed

~~Build this early so UI components stay clean and swappable.~~

### Build

```text
/lib/data/incidentDataSource.ts
/lib/data/apiIncidentDataSource.ts
/lib/data/operatorActions.ts
/lib/data/apiOperatorActions.ts
/lib/data/simulationClient.ts
/lib/data/respondersClient.ts
```

### Requirements

- ~~Dashboard should consume `IncidentDataSource` instead of directly calling fetch everywhere.~~
- ~~Operator buttons should consume `OperatorActions`.~~
- ~~Simulation controls should consume `simulationClient`.~~
- ~~Responder layer should consume `respondersClient`.~~
- ~~First implementation should use local API routes and fallback data.~~
- Later, replace internals with Supabase Realtime/API implementations.

### APIs to use now

```text
GET /api/dev/incidents
GET /api/responders/mock
POST /api/operator/takeover
POST /api/operator/update-incident
POST /api/operator/resolve
POST /api/operator/send-sms
POST /api/simulate/disaster
POST /api/simulate/world-cup
```

### Cursor prompt

```text
I am Team Member 4: Mapbox + Dashboard UX.

Build Phase 2: data and action adapters.

Create:
- /lib/data/incidentDataSource.ts
- /lib/data/apiIncidentDataSource.ts
- /lib/data/operatorActions.ts
- /lib/data/apiOperatorActions.ts
- /lib/data/simulationClient.ts
- /lib/data/respondersClient.ts

Update DashboardShell to consume these adapters.

Requirements:
- Components should consume typed adapters, not scattered fetch calls.
- apiIncidentDataSource should fetch from GET /api/dev/incidents and fall back to dashboard fallback data.
- apiOperatorActions should support takeOverIncident, updateIncident, resolveIncident, and sendSms through existing /api/operator/* routes.
- simulationClient should call /api/simulate/disaster and /api/simulate/world-cup.
- respondersClient should call /api/responders/mock.
- After operator or simulation actions, DashboardShell should refetch incidents.
- Preserve Phase 1 Mapbox behavior, including immediate map mount during incident loading, fallback incidents, queue selection, pin selection, and drawer updates.
- Do not implement new dashboard buttons or Phase 3/8 UI beyond what is needed to wire adapters.
- Do not implement Supabase Realtime yet.
- Do not change backend routes, API contracts, shared types, validation, Supabase, AI, or voice code.
- If full lint fails because of unrelated pre-existing files, run targeted lint/checks on changed files and report both results.
- Keep npm run dev working.
```

---

## Phase 3 — Incident Queue + Incident Drawer UX — Completed

### Build

```text
/components/incidents/IncidentQueue.tsx
/components/incidents/IncidentCard.tsx
/components/incidents/IncidentDrawer.tsx
/components/incidents/MissingFieldsChecklist.tsx
/components/voice/LiveTranscriptPanel.tsx
/components/voice/CallControlPanel.tsx
```

### Requirements

Incident queue:

- ~~Sort active incidents by urgency and `priority_score`.~~
- ~~Add filters for:~~
  - ~~mode~~
  - ~~urgency~~
  - ~~status~~
  - ~~assigned operator~~
- ~~Critical incidents should visually stand out.~~
- ~~Selected incident should be highlighted.~~
- ~~Queue should be usable in less than 5 seconds during demo.~~

Incident drawer:

- ~~Show incident type.~~
- ~~Show urgency.~~
- ~~Show status.~~
- ~~Show mode.~~
- ~~Show control state.~~
- ~~Show AI active state.~~
- ~~Show operator required.~~
- ~~Show assigned operator.~~
- ~~Show location status.~~
- ~~Show location.~~
- ~~Show coordinates.~~
- ~~Show summary.~~
- ~~Show missing fields.~~
- ~~Show collected fields.~~
- ~~Show recommended action.~~
- ~~Show priority score.~~
- ~~Show cluster ID.~~
- ~~Show transcript preview if available.~~
- ~~Add buttons:~~
  - ~~Take Over~~
  - ~~Mark Resolved~~
  - ~~Send SMS~~
  - ~~Add Note / Update Incident~~

Button behavior:

- ~~Take Over should call `OperatorActions.takeOverIncident`.~~
- ~~Mark Resolved should call `OperatorActions.resolveIncident`.~~
- ~~Send SMS should call `OperatorActions.sendSms`.~~
- ~~Add Note / Update Incident should call `OperatorActions.updateIncident`.~~
- ~~After every action, refetch incidents.~~
- ~~Do not mutate critical state only in local React state.~~

### Cursor prompt

```text
I am Team Member 4: Mapbox + Dashboard UX.

Build Phase 3: incident queue and incident drawer UX.

Create or update:
- /components/incidents/IncidentQueue.tsx
- /components/incidents/IncidentCard.tsx
- /components/incidents/IncidentDrawer.tsx
- /components/incidents/MissingFieldsChecklist.tsx
- /components/voice/LiveTranscriptPanel.tsx
- /components/voice/CallControlPanel.tsx

Requirements:
- Display incidents sorted by urgency and priority_score.
- Add filters for mode, urgency, status, and assigned operator.
- Highlight selected and critical incidents.
- Drawer should show incident_type, urgency, status, mode, control_state, ai_active, location, location_status, summary, missing_fields, collected_fields, recommended_action, priority_score, cluster_id, and transcript preview.
- Add Take Over, Mark Resolved, Send SMS, and Add Note buttons.
- Buttons should call OperatorActions adapter methods, not hardcoded fetch calls.
- Handle missing/null fields cleanly.
- Refetch incidents after actions.
- Keep npm run dev working.
```

---

## Phase 4 — Responder Visualization + Layer Controls — Completed

### Build

```text
/components/map/ResponderLayer.tsx
/components/map/MapLayerControls.tsx
/lib/data/respondersClient.ts
/lib/map/layers.ts
```

### Requirements

- ~~Fetch responders from `GET /api/responders/mock`.~~
- ~~Show ambulance, fire, police, and event staff markers.~~
- ~~Use clean pins or simple markers, not goofy icons.~~
- ~~Add layer toggles for:~~
  - ~~incidents~~
  - ~~responders~~
  - ~~heatmap~~
  - ~~clusters~~
  - ~~disaster zones~~
  - ~~blocked roads~~
  - ~~event layers~~
  - ~~route lines~~
- ~~All modes should be able to show responder locations.~~
- ~~Toggling layers should not reinitialize the full Mapbox map.~~

### Cursor prompt

```text
I am Team Member 4: Mapbox + Dashboard UX.

Build Phase 4: responder visualization and map layer controls.

Create or update:
- /components/map/ResponderLayer.tsx
- /components/map/MapLayerControls.tsx
- /lib/data/respondersClient.ts
- /lib/map/layers.ts
- /components/map/CommandMap.tsx

Requirements:
- Fetch responders from GET /api/responders/mock.
- Show ambulances, fire, police, and event staff as clean map pins/markers.
- Add layer toggles for incidents, responders, heatmap, clusters, disaster zones, blocked roads, event layers, and route lines.
- Do not use distracting icons.
- Do not use Mapbox popups as the primary UI.
- Keep responder data schema-compatible with shared types.
- Keep Normal Mode working.
```

---

## Phase 5 — Disaster Mode Layers — Completed

### Build

```text
/components/map/HeatmapLayer.tsx
/components/map/ClusterLayer.tsx
/lib/mock/disasterLayers.ts
/lib/mock/clusters.ts
/lib/map/clustering.ts
```

### Requirements

- ~~Add heatmap layer from incident coordinates.~~
- ~~Add cluster circles.~~
- ~~Add disaster impact zones as GeoJSON polygons.~~
- ~~Add blocked roads as GeoJSON lines.~~
- ~~Add responder staging areas if time allows.~~
- ~~Disaster layers should activate in Disaster Mode or when toggled.~~
- ~~Use frontend-derived or mock `SurgeCluster[]` for now.~~
- ~~Do not depend on `/api/surge/analyze` yet.~~
- ~~Do not break Normal Mode.~~
- ~~Do not break World Cup mode.~~

### Cursor prompt

```text
I am Team Member 4: Mapbox + Dashboard UX.

Build Phase 5: Disaster Mode map layers.

Create or update:
- /components/map/HeatmapLayer.tsx
- /components/map/ClusterLayer.tsx
- /lib/mock/disasterLayers.ts
- /lib/mock/clusters.ts
- /lib/map/clustering.ts
- /components/map/CommandMap.tsx
- /components/map/MapLayerControls.tsx

Requirements:
- Add heatmap visualization using incident coordinates.
- Add cluster circles using frontend-derived or mock SurgeCluster[] data.
- Add disaster impact zones as GeoJSON polygons.
- Add blocked roads as GeoJSON lines.
- Disaster layers should be shown in disaster mode or when toggled on.
- Do not depend on /api/surge/analyze yet.
- Do not break normal mode or world_cup mode.
- Keep all mock data schema-compatible.
```

---

## Phase 6 — Cluster Drawer — Completed

### Build

```text
/components/incidents/ClusterDrawer.tsx
/components/incidents/ClusterIncidentList.tsx
/lib/map/clustering.ts
```

### Requirements

- ~~Show cluster title.~~
- ~~Show incident count.~~
- ~~Show urgency breakdown.~~
- ~~Show summary.~~
- ~~Show top recommended action.~~
- ~~Link cluster incidents to the queue.~~
- ~~Selecting a cluster should highlight it on the map.~~
- ~~Selecting an incident inside a cluster should open the normal incident drawer.~~
- ~~Use frontend-derived/mock clusters until `/api/surge/analyze` exists.~~

### Cursor prompt

```text
I am Team Member 4: Mapbox + Dashboard UX.

Build Phase 6: cluster drawer.

Create:
- /components/incidents/ClusterDrawer.tsx
- /components/incidents/ClusterIncidentList.tsx
- /lib/map/clustering.ts

Update DashboardShell and CommandMap so selecting a cluster highlights it on the map and opens the cluster drawer.

Requirements:
- Use shared SurgeCluster type if available.
- Show title, incident count, urgency breakdown, summary, and top recommended action.
- Link incidents in the cluster to the incident queue and drawer.
- Selecting an incident inside the cluster should open the incident drawer.
- Keep existing selected incident behavior working.
- Do not depend on /api/surge/analyze yet.
```

---

## Phase 7 — World Cup / Event Surge Layers — Completed

### Build

```text
/components/map/EventLayer.tsx
/lib/mock/worldCupLayers.ts
```

### Requirements

Add mock event geography:

- ~~stadium perimeter~~
- ~~fan zones~~
- ~~medical tents~~
- ~~police/security tents~~
- ~~lost-and-found points~~
- ~~tourist help points~~
- ~~transit nodes~~
- ~~restricted vehicle zones~~
- ~~high-density crowd zones~~
- ~~road closures~~

~~World Cup layers should appear only in `world_cup` mode or when explicitly toggled.~~

### Cursor prompt

```text
I am Team Member 4: Mapbox + Dashboard UX.

Build Phase 7: World Cup / Event Surge Mode map layers.

Create or update:
- /components/map/EventLayer.tsx
- /lib/mock/worldCupLayers.ts
- /components/map/CommandMap.tsx
- /components/map/MapLayerControls.tsx

Requirements:
- Add stadium perimeter polygon.
- Add fan-zone polygons.
- Add medical tents, police/security tents, lost-and-found, tourist help, transit nodes, restricted vehicle zones, high-density crowd zones, and road closures.
- Store layer data as EventLayer[] or GeoJSON-compatible mock data matching shared types.
- Only show these layers in world_cup mode or when toggled on.
- Do not break Disaster Mode or Normal Mode.
```

---

## Phase 8 — Demo Controls + Simulation Buttons — Completed

### Build

```text
/components/dashboard/DemoControls.tsx
/components/dashboard/StatusMetrics.tsx
/components/dashboard/OperatorLoadPanel.tsx
/lib/data/simulationClient.ts
```

### Requirements

- ~~Add visible mode switcher.~~
- ~~Add active calls count.~~
- ~~Add critical count.~~
- ~~Add operator load.~~
- ~~Add simulation buttons:~~
  - ~~Trigger Disaster Simulation~~
  - ~~Trigger World Cup Simulation~~
  - ~~Refresh Incidents~~
  - ~~Reset View / Clear Selection~~
- ~~Use:~~
  - ~~`POST /api/simulate/disaster`~~
  - ~~`POST /api/simulate/world-cup`~~
  - ~~`GET /api/dev/incidents`~~
- ~~After triggering a simulation, refetch incidents.~~
- ~~Show loading state while simulation is running.~~
- ~~Show success/error message.~~
- ~~Do not assume Supabase is configured.~~
- ~~Simulation should work with in-memory fallback.~~
- ~~Add obvious visual distinction between Normal, Disaster, and World Cup modes.~~

### Cursor prompt

```text
I am Team Member 4: Mapbox + Dashboard UX.

Build Phase 8: demo controls and simulation buttons.

Create or update:
- /components/dashboard/DemoControls.tsx
- /components/dashboard/StatusMetrics.tsx
- /components/dashboard/OperatorLoadPanel.tsx
- /lib/data/simulationClient.ts
- /components/dashboard/TopBar.tsx
- /components/dashboard/DashboardShell.tsx

Requirements:
- Add visible mode switcher for normal, disaster, and world_cup.
- Add active calls count, critical count, and operator load.
- Add buttons for disaster simulation and world cup simulation using existing /api/simulate/* endpoints.
- Add refresh incidents button.
- Add reset view / clear selection button.
- After simulation actions, refetch incidents.
- Add clear visual differences between modes.
- Keep the dashboard impressive but not cluttered.
```

---

## Phase 9 — API Operator Actions — Completed

### Build

```text
/lib/data/apiOperatorActions.ts
/components/voice/CallControlPanel.tsx
/components/incidents/IncidentDrawer.tsx
```

### Requirements

- ~~Wire Take Over to `POST /api/operator/takeover`.~~
- ~~Wire Mark Resolved to `POST /api/operator/resolve`.~~
- ~~Wire Send SMS to `POST /api/operator/send-sms`.~~
- ~~Wire Add Note / Update Incident to `POST /api/operator/update-incident`.~~
- ~~Show loading state while action is running.~~
- ~~Show error state if action fails.~~
- ~~Refetch incidents after action success.~~
- ~~Do not directly patch critical incident state only in local React state.~~

### Cursor prompt

```text
I am Team Member 4: Mapbox + Dashboard UX.

Build Phase 9: API operator actions.

Create or update:
- /lib/data/apiOperatorActions.ts
- /components/voice/CallControlPanel.tsx
- /components/incidents/IncidentDrawer.tsx
- /components/dashboard/DashboardShell.tsx

Requirements:
- Take Over should call POST /api/operator/takeover.
- Mark Resolved should call POST /api/operator/resolve.
- Send SMS should call POST /api/operator/send-sms.
- Add Note or Update Incident should call POST /api/operator/update-incident.
- Show loading and error states for actions.
- Refetch incidents after successful actions.
- Do not mutate critical state only in React local state.
- Keep npm run dev working.
```

---

## Phase 10 — Realtime Dashboard Integration — Completed

~~This phase depends on frontend Supabase Realtime readiness. Do not build it first.~~

### Build later

```text
/lib/data/supabaseIncidentDataSource.ts
/lib/data/supabaseTranscriptDataSource.ts
```

### Requirements

- ~~Load initial incidents from Supabase when env vars are available.~~
- ~~Subscribe to `incidents` updates.~~
- ~~Update incident queue without refresh.~~
- ~~Add/update/remove map pins when incidents change.~~
- ~~Only show pins when coordinates exist.~~
- ~~Selected incident drawer should update live.~~
- ~~Subscribe to `transcript_events` for selected incident.~~
- ~~If Supabase env vars are missing, fall back to API/fallback data.~~

### Cursor prompt

```text
I am Team Member 4: Mapbox + Dashboard UX.

Build Phase 10: realtime dashboard integration adapters.

Create or update:
- /lib/data/supabaseIncidentDataSource.ts
- /lib/data/supabaseTranscriptDataSource.ts
- /components/dashboard/DashboardShell.tsx

Requirements:
- Keep API/fallback data path if Supabase env vars are missing.
- Load initial incidents from Supabase when available.
- Subscribe to incident changes through Supabase Realtime.
- Update queue, selected drawer, and map pins without refresh.
- Subscribe to transcript_events for selected incident.
- Do not rewrite UI components unnecessarily.
```

---

## Phase 11 — Demo Polish — Completed

### Build

```text
/components/dashboard/DemoControls.tsx
/components/dashboard/StatusMetrics.tsx
/components/dashboard/OperatorLoadPanel.tsx
/components/dashboard/TopBar.tsx
/components/dashboard/DashboardShell.tsx
```

### Requirements

- ~~Make the map the visual centerpiece.~~
- ~~Critical calls should be immediately obvious.~~
- ~~Disaster and World Cup modes should look meaningfully different.~~
- ~~Operators should understand what needs attention in less than 5 seconds.~~
- ~~Add clean loading, empty, and error states.~~
- ~~Add polished visual states for:~~
  - active AI call
  - collecting location
  - transferring to operator
  - human active
  - resolved
- ~~Keep the dashboard impressive but not cluttered.~~
- ~~Use layer toggles to reduce visual noise.~~

### Cursor prompt

```text
I am Team Member 4: Mapbox + Dashboard UX.

Build Phase 11: final dashboard demo polish.

Create or update:
- /components/dashboard/DemoControls.tsx
- /components/dashboard/StatusMetrics.tsx
- /components/dashboard/OperatorLoadPanel.tsx
- /components/dashboard/TopBar.tsx
- /components/dashboard/DashboardShell.tsx
- /components/incidents/IncidentCard.tsx
- /components/incidents/IncidentDrawer.tsx
- /components/map/CommandMap.tsx
- /components/map/MapLayerControls.tsx

Requirements:
- Make the dashboard look like an emergency operations command center.
- Make critical calls visually obvious.
- Make map the visual centerpiece.
- Add visual distinction between normal, disaster, and world_cup modes.
- Add visual states for active AI call, collecting location, transferring, human active, and resolved.
- Keep UI polished but not cluttered.
- Keep npm run dev working.
```

---

# Design / UX Requirements

## Dashboard layout

```text
Top bar: mode, active calls, critical count, operator load
Left panel: incident queue, filters, cluster list
Center: Mapbox command map
Right drawer: selected incident or selected cluster
Transcript/call controls: inside drawer or side panel
```

## Visual priorities

- Critical calls should be immediately obvious.
- The map should be the visual centerpiece.
- Disaster and World Cup modes should look meaningfully different.
- Operators should understand what needs attention in less than 5 seconds.
- Use side drawers instead of popups for operational details.
- Avoid clutter.
- Use layer toggles.
- Show AI state and operator control state clearly.

## Incident drawer fields

Show:

```text
public_id
id
mode
incident_type
urgency
status
control_state
ai_active
operator_required
assigned_operator
location_status
location_confidence
location
coordinates
summary
missing_fields
collected_fields
custom_fields
recommended_action
priority_score
cluster_id
transcript preview
audio_url if available
transcript_url if available
operator actions
```

## Queue sorting order

Sort by:

1. critical before urgent
2. higher priority_score
3. active/transferring/human_active before resolved
4. newest updated_at

---

# Mapbox Rules

- Use Mapbox GL JS only inside client components.
- Initialize map after the component mounts.
- Initialize the map once; do not reinitialize it for mode changes, layer toggles, or data refreshes.
- Use `NEXT_PUBLIC_MAPBOX_TOKEN`.
- Show a clear configuration error if `NEXT_PUBLIC_MAPBOX_TOKEN` is missing.
- Clean up map instance on unmount.
- Keep marker/layer updates stable when React state changes.
- Do not show pins for incidents with null coordinates.
- Do not use ugly default browser popups.
- Prefer side drawer for selected incident details.
- Use urgency-based styling.
- Keep all mode-specific layers toggleable.
- Disaster layers must not break Normal Mode.
- World Cup layers must not break Disaster Mode.
- Layer toggles should not reinitialize the whole map.
- Keep map style visually polished and not default-looking if possible.
- Add Mapbox sources/layers only after `load` or `style.load`.
- Guard every `addSource` and `addLayer` with `getSource` / `getLayer` checks.
- Clean up markers, event listeners, observers, animation frames, and the map instance.
- Use GeoJSON `symbol`, `circle`, or `heatmap` layers for larger point sets; keep HTML markers for small counts.
- Validate GeoJSON shape before adding disaster or event layers.
- Validate style expressions when adding heatmap, cluster, line, fill, or fill-extrusion layers.
- Convert shared `{ lat, lng }` coordinates to Mapbox `[lng, lat]` coordinates at the map boundary.
- Toronto can remain the default demo viewport, but reusable helpers should support configurable centers/bounds from incidents, simulations, event centers, or mode config.
- Avoid hardcoding Toronto in reusable layer/data helpers; use `fitBounds` or computed bounds for non-Toronto scenarios.

---

# Mock / Fallback Data Requirements

Mock/fallback data should live in `/lib/mock`.

Required or useful mock files:

```text
/lib/mock/dashboardFallbackData.ts
/lib/mock/incidents.ts
/lib/mock/responders.ts
/lib/mock/disasterLayers.ts
/lib/mock/worldCupLayers.ts
/lib/mock/clusters.ts
/lib/mock/transcripts.ts
```

Mock incidents should include:

- normal stolen bike / lost item
- urgent medical incident
- critical active break-in
- disaster trapped person
- blocked road
- gas smell
- World Cup lost person
- World Cup crowd congestion
- World Cup medical tent request
- World Cup theft/security issue

Keep descriptions safe, concise, and demo-oriented.

---

# Environment Variables

For current Member 4 work:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=your_existing_mapbox_token_here
AI_PROVIDER=mock
```

Do not put private backend keys in client components.

Do not commit `.env.local`.

---

# Definition of Done For Member 4 Features

A Member 4 feature is done when:

- `/dashboard` still loads.
- Mapbox still renders with the local token.
- Existing queue selection, map pin selection, and drawer behavior still work.
- Fallback data still works when `/api/dev/incidents` is empty or fails.
- It uses shared types from `/lib/types`.
- It uses API contracts from `docs/api_contracts.md`.
- Mock/fallback data matches the real schema.
- It works locally with only `NEXT_PUBLIC_MAPBOX_TOKEN` and `AI_PROVIDER=mock`.
- It does not require Supabase/Twilio/ElevenLabs/Gemma/Featherless keys.
- It handles loading, empty, and error states.
- It does not break `npm run dev`.
- It does not create duplicate fake types.
- It does not change backend routes or API contracts unless explicitly assigned.
- It can later connect to Supabase/API through adapters.
- It keeps the map as the visual centerpiece.
- It improves demo clarity.
- Full checks pass, or unrelated full-check failures are documented with targeted checks passing for changed files.
- `docs/project_plan.md` and this Member 4 file are updated for the completed phase/substep.

---

# Final Integration Checklist

Before demo, verify:

- `/dashboard` loads without errors.
- Mapbox renders using local token.
- Incidents render as pins.
- Queue selects incidents.
- Map pins select incidents.
- Drawer shows full incident details.
- Critical incidents are visually obvious.
- Responder markers work.
- Disaster layers toggle correctly.
- World Cup layers toggle correctly.
- Cluster drawer works.
- Simulation buttons work or fail gracefully.
- Operator buttons call `/api/operator/*` adapters cleanly.
- UI refetches incidents after operator/simulation actions.
- Supabase incident subscription works or API/fallback path works.
- No Member 4 code depends directly on AI/voice internals.
- `npm run dev` still works.
- `npx tsc --noEmit` passes if time allows.
- `npm run test:run` passes if the team has tests configured.

---

# Current Best Cursor Prompt

Use this prompt for the next implementation pass:

```text
I am Team Member 4: Mapbox + Dashboard UX.

Read:
- docs/project_details.md
- docs/project_plan.md
- docs/api_contracts.md
- docs/team/member1_fullstack_integration.md
- docs/team/member4_mapbox_dashboard.md

Member 1 has already implemented shared types, API contracts, call endpoints, operator endpoints, simulation endpoints, responder mock endpoint, dev incident endpoint, and in-memory fallback persistence.

I already have NEXT_PUBLIC_MAPBOX_TOKEN in .env.local.
I do not have Supabase, Twilio, ElevenLabs, Gemma, or Featherless keys yet.
Use AI_PROVIDER=mock and local backend fallback paths.

Build the dashboard using existing shared types from /lib/types.
Do not create duplicate dashboard-only types.
Before Mapbox-specific edits, use relevant Mapbox skills and Mapbox DevKit MCP when API behavior, sources/layers, style expressions, token security, validation, or performance are uncertain.

Use:
- GET /api/dev/incidents for initial incident list
- GET /api/responders/mock for responders
- POST /api/operator/takeover for Take Over
- POST /api/operator/resolve for Mark Resolved
- POST /api/operator/update-incident for safe edits/notes if needed
- POST /api/operator/send-sms for Send SMS, even if it is currently a stub
- POST /api/simulate/disaster for disaster demo trigger
- POST /api/simulate/world-cup for world cup demo trigger

Do not depend on /api/surge/analyze yet because it is not implemented.
Do not implement Supabase Realtime yet. Use fetch/refetch first.
Do not touch app/api, lib/ai, lib/db, lib/server, lib/supabase, lib/validation, voice code, migrations, or shared contracts unless explicitly assigned.
Keep npm run dev working.
If full lint fails because of unrelated pre-existing files, run targeted lint/checks for changed files and report both results.
Prefer complete updated files when changing many lines.
```

---

# Phase 1 Completion Notes

## Completed Member 4 Steps

- Completed **Phase 1 — Dashboard Shell + Core Mapbox**.
- Created `/dashboard` with the required command-center layout: top bar, left incident queue, center Mapbox panel, and right incident drawer.
- Wired the dashboard to `GET /api/dev/incidents` first, with schema-compatible fallback incidents from `/lib/mock/dashboardFallbackData.ts` only when the API returns empty data or fails.
- Rendered incident pins from shared `Incident` objects and skipped pins for incidents without coordinates.
- Kept queue selection, map pin selection, and drawer updates working from the same selected incident state.
- Confirmed the dashboard does not call AI, voice, Supabase Realtime, or backend internals directly.

## Phase 1 Lessons Learned

- `mapbox-gl/dist/mapbox-gl.css` is required or the base map may render blank/mis-sized even when tiles load.
- Mapbox must mount in a client component after React mount.
- `ResizeObserver` plus `map.resize()` is needed so the Mapbox canvas fills the dashboard center panel.
- The marker outer wrapper lets Mapbox own positioning; the inner button owns visual styling and click behavior.
- Marker clicks should stop propagation so map drag/zoom handlers do not interfere with incident selection.
- 3D terrain/building setup should run after map load and be guarded with `getSource` / `getLayer` checks.
- Added a Phase 1 3D command-map presentation with terrain, fog, building extrusion, stronger pitch/bearing, and selected-incident fly-to behavior.
- Removed temporary debug instrumentation and confirmed no `127.0.0.1` debug ingest calls remain in Phase 1 code.
- Stabilized initial dashboard loading so `CommandMap` mounts immediately while `/api/dev/incidents` fetches incident data.

## What Member 1 Can Do Next

- Use `/dashboard` as the API-ready visual integration target for existing `GET /api/dev/incidents`, `/api/simulate/*`, `/api/responders/mock`, and `/api/operator/*` routes.
- Verify that newly created or simulated incidents appear on the queue/map as long as they follow the shared `Incident` contract and include coordinates for map pins.
- Continue improving backend persistence and dev incident listing without needing Member 4 to change dashboard-only data shapes.
- Add future API/action adapters in Phase 2 without changing the core dashboard layout or shared `Incident` rendering assumptions.

## What Member 3 Can Do Next

- Use the dashboard as a live visual check for AI triage outputs that update `urgency`, `incident_type`, `status`, `control_state`, `summary`, `missing_fields`, `recommended_action`, `priority_score`, and `coordinates`.
- Validate that mock/Gemma triage outputs produce operator-visible state changes without needing any direct dashboard-to-AI calls.
- Tune AI output quality for map usefulness, especially reliable location text, coordinate confidence, urgency, and concise summaries.
- Prepare future surge/cluster intelligence knowing Phase 1 already renders incidents from shared contracts and is ready for later cluster/layer UI work.
