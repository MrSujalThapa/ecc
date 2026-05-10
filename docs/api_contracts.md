# API Contracts — AI Emergency Operations Platform

## Purpose

This document defines the shared contracts between frontend, backend, AI agents, voice/telephony, Supabase, and Mapbox.

Use this file as the contract source for implementation. The goal is to let teammates build in parallel without creating incompatible data shapes.

## Contract Rules

- Use these contracts before building UI, API routes, mock data, or AI schemas.
- Do not create duplicate fake shapes for `Incident`, `CallSession`, `TranscriptEvent`, `Responder`, `EventLayer`, or `SurgeCluster`.
- Mock data must use the same field names and enum values as these contracts.
- Frontend components should consume these contracts through typed data/action adapters.
- Backend endpoints should validate request bodies before mutating state.
- AI output must be validated before merging into `Incident` or `CallSession`.
- Backend owns state changes. Frontend buttons should call API routes, not directly mutate critical state.

---

## 1. Core TypeScript Types

Recommended location:

```text
/lib/types/core.ts
/lib/types/api.ts
/lib/types/ai.ts
```

### 1.1 Shared primitives

```ts
export type UUID = string;
export type ISODateString = string;

export type Coordinates = {
  lat: number;
  lng: number;
};
```

### 1.2 Mode enum

```ts
export type SystemMode = "normal" | "disaster" | "world_cup";
```

### 1.3 Urgency enum

```ts
export type IncidentUrgency =
  | "unknown"
  | "non_emergency"
  | "urgent"
  | "critical";
```

### 1.4 Incident status enum

```ts
export type IncidentStatus =
  | "active_call"
  | "collecting_location"
  | "transferring_to_operator"
  | "human_active"
  | "ai_handled"
  | "resolved"
  | "abandoned";
```

### 1.5 Control state enum

```ts
export type ControlState =
  | "ai_leading"
  | "ai_location_collection"
  | "transferring"
  | "human_active"
  | "ai_completed";
```

### 1.6 Location status enum

```ts
export type LocationStatus =
  | "unknown"
  | "approximate_by_ai"
  | "confirmed_by_ai"
  | "confirmed_by_operator";
```

### 1.7 Operator transfer status enum

```ts
export type OperatorTransferStatus =
  | "not_requested"
  | "requested"
  | "transferring"
  | "transferred"
  | "failed";
```

### 1.8 Transcript speaker enum

```ts
export type TranscriptSpeaker = "caller" | "ai" | "operator" | "system";
```

---

## 2. Main Domain Objects

### 2.1 Incident

Permanent source of truth for dashboard, map, operator workflow, and incident state.

```ts
export type Incident = {
  id: UUID;
  public_id: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;

  mode: SystemMode;
  urgency: IncidentUrgency;
  incident_type: string;
  status: IncidentStatus;

  operator_required: boolean | null;
  assigned_operator: string | null;
  control_state: ControlState;
  ai_active: boolean;

  location_status: LocationStatus;
  location_confidence: number | null;
  location: string | null;
  coordinates: Coordinates | null;

  summary: string | null;
  collected_fields: Record<string, unknown>;
  missing_fields: string[];
  custom_fields: Record<string, unknown>[];
  recommended_action: string | null;

  priority_score: number | null;
  cluster_id: string | null;

  transcript_url: string | null;
  audio_url: string | null;
  last_updated_by: string;
};
```

### 2.2 CallSession

Temporary AI conversation state for one live call.

```ts
export type CallSession = {
  id: UUID;
  incident_id: UUID;

  twilio_call_sid: string | null;
  elevenlabs_conversation_id: string | null;
  /** Twilio inbound From (E.164 when PSTN); used for operator SMS when `to` is omitted. */
  caller_phone: string | null;

  status: "active" | "closed";
  ai_active: boolean;
  turn_count: number;

  recent_transcript: TranscriptEvent[];
  required_fields: string[];
  missing_fields: string[];
  next_question: string | null;

  last_model_confidence: number | null;
  should_escalate: boolean;
  operator_transfer_status: OperatorTransferStatus;

  created_at: ISODateString;
  updated_at: ISODateString;
};
```

### 2.3 TranscriptEvent

Stores final transcript turns and optional partial/translated text.

```ts
export type TranscriptEvent = {
  id: UUID;
  incident_id: UUID;
  call_session_id: UUID | null;
  speaker: TranscriptSpeaker;
  text: string;
  is_final: boolean;
  language: string | null;
  translated_text: string | null;
  created_at: ISODateString;
};
```

### 2.4 AuditLog

Every important state mutation should create an audit log.

```ts
export type AuditLog = {
  id: UUID;
  incident_id: UUID;
  actor: "system" | "ai" | "operator" | "voice" | string;
  action: string;
  patch: Record<string, unknown> | null;
  created_at: ISODateString;
};
```

### 2.5 Responder

Used by Mapbox to visualize ambulances, fire units, police, and event staff.

```ts
export type ResponderType = "ambulance" | "fire" | "police" | "event_staff";

export type ResponderStatus =
  | "available"
  | "assigned"
  | "en_route"
  | "busy"
  | "offline";

export type Responder = {
  id: string;
  type: ResponderType;
  status: ResponderStatus;
  display_name: string;
  coordinates: Coordinates;
  assigned_incident_id: UUID | null;
  updated_at: ISODateString;
};
```

### 2.6 EventLayer

Used for World Cup / event layers and disaster overlays.

```ts
export type EventLayerType =
  | "stadium_perimeter"
  | "fan_zone"
  | "medical_tent"
  | "police_tent"
  | "security_tent"
  | "lost_and_found"
  | "tourist_help"
  | "transit_node"
  | "restricted_vehicle_zone"
  | "crowd_density_zone"
  | "road_closure"
  | "impact_zone"
  | "blocked_road"
  | "responder_staging_area";

export type EventLayer = {
  id: string;
  mode: SystemMode;
  layer_type: EventLayerType;
  name: string;
  geometry: GeoJSON.Geometry;
  metadata: Record<string, unknown>;
};
```

### 2.7 SurgeCluster

Used by dashboard cluster drawer and surge analysis.

```ts
export type SurgeCluster = {
  id: string;
  mode: SystemMode;
  title: string;
  summary: string;
  center: Coordinates;
  radius_meters: number;
  incident_ids: UUID[];
  incident_count: number;
  urgency_breakdown: {
    unknown: number;
    non_emergency: number;
    urgent: number;
    critical: number;
  };
  top_recommended_action: string | null;
  priority_score: number;
};
```

---

## 3. API Response Envelope

All API routes should return one of these shapes.

```ts
export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
```

Example error:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "incident_id is required"
  }
}
```

---

## 4. Backend API Contracts

## 4.1 `POST /api/call/start`

Creates a new empty `Incident` and linked `CallSession`.

### Request

```ts
export type StartCallRequest = {
  mode: SystemMode;
  twilio_call_sid?: string | null;
  elevenlabs_conversation_id?: string | null;
  caller_phone?: string | null;
};
```

### Example request

```json
{
  "mode": "normal",
  "twilio_call_sid": "CAxxxx",
  "elevenlabs_conversation_id": "ELxxxx",
  "caller_phone": "+14155552671"
}
```

### Response

```ts
export type StartCallResponse = {
  incident_id: UUID;
  call_session_id: UUID;
  incident: Incident;
  call_session: CallSession;
};
```

---

## 4.2 `POST /api/call/turn`

Processes one final transcript turn.

The backend should:

1. Save transcript event.
2. Load current Incident and CallSession.
3. Run Call Triage Agent.
4. Validate AI output.
5. Execute safe tools if requested.
6. Update Incident and CallSession.
7. Return the next phrase for ElevenLabs.

### Request

```ts
export type CallTurnRequest = {
  incident_id: UUID;
  call_session_id: UUID;
  speaker: TranscriptSpeaker;
  text: string;
  is_final: boolean;
  language?: string | null;
  translated_text?: string | null;
};
```

### Example request

```json
{
  "incident_id": "00000000-0000-0000-0000-000000000001",
  "call_session_id": "00000000-0000-0000-0000-000000000101",
  "speaker": "caller",
  "text": "Someone stole my bike near Dana Porter Library.",
  "is_final": true,
  "language": "en",
  "translated_text": null
}
```

### Response

```ts
export type CallTurnResponse = {
  say_to_caller: string | null;
  incident: Incident;
  call_session: CallSession;
  transcript_event: TranscriptEvent;
  actions: SystemAction[];
};
```

---

## 4.3 `POST /api/call/end`

Closes an active call session.

### Request

```ts
export type EndCallRequest = {
  incident_id: UUID;
  call_session_id: UUID;
  reason: "completed" | "abandoned" | "transferred" | "operator_closed";
};
```

### Response

```ts
export type EndCallResponse = {
  incident: Incident;
  call_session: CallSession;
};
```

---

## 4.4 `POST /api/operator/takeover`

Operator manually takes over a call.

The backend should:

- set `Incident.status = "human_active"`;
- set `Incident.control_state = "human_active"`;
- set `Incident.ai_active = false`;
- assign the operator;
- close the active CallSession;
- trigger transfer if live call data exists;
- write audit log.

### Request

```ts
export type OperatorTakeoverRequest = {
  incident_id: UUID;
  operator_id: string;
};
```

### Example request

```json
{
  "incident_id": "00000000-0000-0000-0000-000000000001",
  "operator_id": "OP-1"
}
```

### Response

```ts
export type OperatorTakeoverResponse = {
  incident: Incident;
  call_session: CallSession | null;
  transfer_status: OperatorTransferStatus;
};
```

---

## 4.5 `POST /api/operator/update-incident`

Allows operator-safe edits to selected incident fields.

### Request

```ts
export type OperatorUpdateIncidentRequest = {
  incident_id: UUID;
  operator_id: string;
  patch: Partial<Pick<
    Incident,
    | "urgency"
    | "incident_type"
    | "status"
    | "assigned_operator"
    | "location_status"
    | "location_confidence"
    | "location"
    | "coordinates"
    | "summary"
    | "collected_fields"
    | "missing_fields"
    | "custom_fields"
    | "recommended_action"
    | "priority_score"
    | "cluster_id"
  >>;
};
```

### Response

```ts
export type OperatorUpdateIncidentResponse = {
  incident: Incident;
};
```

---

## 4.6 `POST /api/operator/resolve`

Marks an incident as resolved and closes active sessions.

### Request

```ts
export type OperatorResolveRequest = {
  incident_id: UUID;
  operator_id: string;
  resolution_note?: string;
};
```

### Response

```ts
export type OperatorResolveResponse = {
  incident: Incident;
  call_session: CallSession | null;
};
```

---

## 4.7 `POST /api/operator/send-sms`

Sends a short factual SMS confirmation or update.

### Request

```ts
export type OperatorSendSmsRequest = {
  incident_id: UUID;
  operator_id: string;
  message: string;
  /** Optional E.164 override (`/^\\+\\d{10,15}$/`). If omitted, backend uses latest session `caller_phone`. */
  to?: string | null;
};
```

### Response

```ts
export type OperatorSendSmsResponse = {
  incident_id: UUID;
  sent: boolean;
  provider_message_id?: string;
  error?: string;
};
```

---

## 4.8 `GET /api/responders/mock`

Returns fake responder locations for Mapbox.

### Response

```ts
export type MockRespondersResponse = {
  responders: Responder[];
};
```

### Example response

```json
{
  "responders": [
    {
      "id": "EMS-2",
      "type": "ambulance",
      "status": "available",
      "display_name": "EMS Unit 2",
      "coordinates": {
        "lat": 43.641,
        "lng": -79.389
      },
      "assigned_incident_id": null,
      "updated_at": "2026-05-06T20:00:00.000Z"
    }
  ]
}
```

---

## 4.9 `POST /api/simulate/disaster`

Creates simulated disaster calls and processes them through the same backend + AI path as real calls.

### Request

```ts
export type SimulateDisasterRequest = {
  count?: number;
  batch_size?: number;
  center?: Coordinates;
  reset_existing?: boolean;
};
```

### Response

```ts
export type SimulateDisasterResponse = {
  created_incidents: Incident[];
  created_call_sessions: CallSession[];
  mode: "disaster";
};
```

---

## 4.10 `POST /api/simulate/world-cup`

Creates simulated World Cup / event surge calls.

### Request

```ts
export type SimulateWorldCupRequest = {
  count?: number;
  batch_size?: number;
  event_center?: Coordinates;
  reset_existing?: boolean;
};
```

### Response

```ts
export type SimulateWorldCupResponse = {
  created_incidents: Incident[];
  created_call_sessions: CallSession[];
  event_layers: EventLayer[];
  mode: "world_cup";
};
```

---

## 4.11 `POST /api/surge/analyze`

Runs Surge / GeoOps analysis over active incidents.

### Request

```ts
export type SurgeAnalyzeRequest = {
  mode: "disaster" | "world_cup";
  include_responders?: boolean;
  include_event_layers?: boolean;
};
```

### Response

```ts
export type SurgeAnalyzeResponse = {
  clusters: SurgeCluster[];
  updated_incidents: Incident[];
  top_priority_incident_ids: UUID[];
};
```

---

## 5. AI Agent Output Contract

Recommended location:

```text
/lib/types/ai.ts
/lib/ai/schemas/*.ts
```

### 5.1 Tool request

```ts
export type SafeToolName =
  | "geocode_location"
  | "event_zone_lookup"
  | "responder_lookup"
  | "sms_draft";

export type ToolRequest = {
  tool: SafeToolName;
  args: Record<string, unknown>;
  reason: string;
};
```

### 5.1.1 Tool args and results

Tool requests are **proposals** from the AI. The backend:

```text
- validates tool name and args
- executes only allowed tools
- normalizes results
```

Shared tool primitives:

```ts
export type Coordinates = {
  lat: number;
  lng: number;
};

export type ToolExecutionSource =
  | "mock"
  | "mapbox_mcp"
  | "mapbox_api"
  | "static_context"
  | "database"
  | "manual";

export type ToolResult<T = unknown> = {
  tool_request_id: string;
  tool: SafeToolName;
  ok: boolean;
  source: ToolExecutionSource;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  created_at: ISODateString;
};
```

#### `geocode_location`

```ts
export type GeocodeLocationArgs = {
  location_text: string;
  city_context?: string | null;
  country_context?: string | null;
};

export type GeocodeLocationResult = {
  normalized_location: string;
  coordinates: Coordinates;
  confidence: number;
  provider_place_id?: string | null;
};
```

#### `event_zone_lookup`

```ts
export type EventZoneLookupArgs = {
  /**
   * Provide either `coordinates` OR `location_text`.
   * If only `location_text` is present, the backend may resolve it to coordinates
   * (e.g. via geocode_location) before matching zones.
   */
  coordinates?: Coordinates | null;
  location_text?: string | null;
  mode: "world_cup" | "disaster";
  max_results?: number;
};

export type EventZoneMatch = {
  layer_id: string;
  name: string;
  layer_type:
    | "stadium_perimeter"
    | "fan_zone"
    | "medical_tent"
    | "police_tent"
    | "security_tent"
    | "lost_and_found"
    | "tourist_help"
    | "transit_node"
    | "restricted_vehicle_zone"
    | "crowd_density_zone"
    | "road_closure"
    | "impact_zone"
    | "blocked_road"
    | "responder_staging_area";
  distance_meters: number | null;
  contains_location: boolean;
  metadata: Record<string, unknown>;
};

export type EventZoneLookupResult = {
  matches: EventZoneMatch[];
};
```

#### `responder_lookup`

```ts
export type ResponderLookupArgs = {
  incident_id?: UUID | null;
  incident_coordinates: Coordinates;
  responder_types?: ("ambulance" | "fire" | "police" | "event_staff")[];
  max_results?: number;
};

export type ResponderRecommendation = {
  responder_id: string;
  display_name: string;
  type: "ambulance" | "fire" | "police" | "event_staff";
  status: "available" | "assigned" | "en_route" | "busy" | "offline";
  coordinates: Coordinates;
  distance_meters: number;
  estimated_travel_seconds?: number | null;
  reason: string;
};

export type ResponderLookupResult = {
  recommendations: ResponderRecommendation[];
};
```

#### `sms_draft`

```ts
export type SmsDraftArgs = {
  incident_id: UUID;
  language: string;
  summary: string;
  recommended_action?: string | null;
  reference_code?: string | null;
  /**
   * Preferred structured destination (MVP uses only `name`).
   */
  destination?: { name: string } | null;
  /**
   * Legacy alias for destination label (backward compatible).
   */
  destination_name?: string | null;
};

export type SmsDraftResult = {
  message: string;
  language: string;
  character_count: number;
};
```

### 5.2 System action

```ts
export type SystemActionName =
  | "transfer_to_operator"
  | "send_sms"
  | "close_call_session"
  | "none";

export type SystemAction = {
  action: SystemActionName;
  args?: Record<string, unknown>;
  reason: string;
};
```

### 5.3 Call triage output

```ts
export type CallTriageAgentOutput = {
  tool_requests?: ToolRequest[];
  incident_patch: Partial<Incident>;
  call_session_patch: Partial<CallSession>;
  system_actions?: SystemAction[];
  say_to_caller: string | null;
};
```

### Example non-emergency output

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
  "system_actions": [],
  "say_to_caller": "Can you describe the bike and when it was stolen?"
}
```

---

## 6. Frontend Data Adapter Contracts

Team Member 4 should use adapters so the dashboard can run on mocks first and Supabase later.

Recommended location:

```text
/lib/data/incidentDataSource.ts
/lib/data/operatorActions.ts
```

### 6.1 IncidentDataSource

```ts
export type IncidentDataSource = {
  getInitialIncidents(): Promise<Incident[]>;
  subscribeToIncidents(
    onChange: (incidents: Incident[]) => void,
    onError?: (error: Error) => void
  ): () => void;
};
```

### 6.2 TranscriptDataSource

```ts
export type TranscriptDataSource = {
  getTranscriptEvents(incidentId: UUID): Promise<TranscriptEvent[]>;
  subscribeToTranscriptEvents(
    incidentId: UUID,
    onChange: (events: TranscriptEvent[]) => void,
    onError?: (error: Error) => void
  ): () => void;
};
```

### 6.3 ResponderDataSource

```ts
export type ResponderDataSource = {
  getResponders(): Promise<Responder[]>;
  subscribeToResponders?(
    onChange: (responders: Responder[]) => void,
    onError?: (error: Error) => void
  ): () => void;
};
```

### 6.4 OperatorActions

```ts
export type OperatorActions = {
  takeOverIncident(input: OperatorTakeoverRequest): Promise<OperatorTakeoverResponse>;
  updateIncident(input: OperatorUpdateIncidentRequest): Promise<OperatorUpdateIncidentResponse>;
  resolveIncident(input: OperatorResolveRequest): Promise<OperatorResolveResponse>;
  sendSms(input: OperatorSendSmsRequest): Promise<OperatorSendSmsResponse>;
};
```

Mock implementations should live in `/lib/mock` or `/lib/data/mock*`.

---

## 7. Mapbox Contract Requirements

The map should only need these objects:

```ts
export type CommandMapProps = {
  mode: SystemMode;
  incidents: Incident[];
  responders: Responder[];
  eventLayers: EventLayer[];
  clusters: SurgeCluster[];
  selectedIncidentId: UUID | null;
  selectedClusterId: string | null;
  onSelectIncident: (incidentId: UUID) => void;
  onSelectCluster: (clusterId: string) => void;
};
```

Mapbox should not call Supabase or backend APIs directly. It should receive typed state from the dashboard shell.

---

## 8. Validation Rules

### AI validation

- Reject unknown tools.
- Reject direct DB write requests.
- Ignore unsafe fields that are not part of the allowed patch schema.
- Validate `coordinates.lat` and `coordinates.lng` before adding a map pin.
- Emergency transfer requires backend validation.
- JSON parse failure should trigger fallback behavior or escalation.

### Frontend validation

- Do not render a pin if `incident.coordinates` is null.
- Do not assume `summary`, `location`, or `recommended_action` exists.
- Display missing values clearly.
- Queue and drawer should handle empty/loading/error states.

### Operator action validation

- `operator_id` is required for operator actions.
- `incident_id` is required.
- Only allowed patch fields can be updated.
- Every operator action should create an audit log.

---

## 9. Contract Freeze

After these types and endpoints are implemented, only change them intentionally:

- `Incident`
- `CallSession`
- `TranscriptEvent`
- `Responder`
- `EventLayer`
- `SurgeCluster`
- `/api/call/turn` request/response
- LLM output schema
- Supabase table names and key fields

If any of these change, update:

1. TypeScript types
2. mock data
3. API routes
4. frontend components
5. AI schemas
6. project docs
