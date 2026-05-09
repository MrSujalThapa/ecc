/**
 * Domain entities aligned with `project_details.md` §12 (schema) and §18 (Mapbox),
 * scoped to `project_full_context_and_future_features.md` §1–§10 (core pipeline + modes + map).
 */

import type {
  AppMode,
  CallSessionStatus,
  LocationStatus,
  OperatorTransferStatus,
  Urgency,
} from "./enums";
import type { Coordinates, GeoJsonGeometry } from "./geo";
import type { Json } from "./json";

/** incidents — `project_details.md` §12.1 (`incidents` table). */
export type Incident = {
  id: string;
  public_id: string | null;
  created_at: string;
  updated_at: string;

  mode: AppMode;
  urgency: Urgency;
  incident_type: string;
  /** Typical values: see INCIDENT_STATUSES in ./enums.ts */
  status: string;
  operator_required: boolean | null;
  assigned_operator: string | null;
  /** Typical values: see CONTROL_STATES in ./enums.ts */
  control_state: string;
  ai_active: boolean;

  location_status: LocationStatus;
  location_confidence: number | null;
  location: string | null;
  coordinates: Coordinates | null;

  summary: string | null;
  collected_fields: Record<string, Json>;
  missing_fields: string[];
  custom_fields: Json[];
  recommended_action: string | null;

  priority_score: number | null;
  cluster_id: string | null;

  transcript_url: string | null;
  audio_url: string | null;
  last_updated_by: string;
};

/** call_sessions — `project_details.md` §12.2 (`call_sessions` table). */
export type CallSession = {
  id: string;
  incident_id: string;

  twilio_call_sid: string | null;
  elevenlabs_conversation_id: string | null;

  status: CallSessionStatus;
  ai_active: boolean;
  turn_count: number;

  recent_transcript: Json[];
  required_fields: Json[];
  missing_fields: string[];
  next_question: string | null;

  last_model_confidence: number | null;
  should_escalate: boolean;
  operator_transfer_status: OperatorTransferStatus;

  created_at: string;
  updated_at: string;
};

/** transcript_events — `project_details.md` §12.3 (`transcript_events` table). */
export type TranscriptEvent = {
  id: string;
  incident_id: string;
  call_session_id: string;
  speaker: string;
  text: string;
  is_final: boolean;
  language: string | null;
  translated_text: string | null;
  created_at: string;
};

/** audit_logs — `project_details.md` §12.4 (`audit_logs` table). */
export type AuditLog = {
  id: string;
  incident_id: string | null;
  actor: string;
  action: string;
  patch: Json | null;
  created_at: string;
};

/** responders — `project_details.md` §12.5 / §18 (mock responder shape). */
export type Responder = {
  id: string;
  type: string;
  status: string;
  display_name: string;
  coordinates: Coordinates;
  assigned_incident_id: string | null;
  updated_at: string;
};

/** event_layers — `project_details.md` §12.6 (`event_layers` table). */
export type EventLayer = {
  id: string;
  mode: AppMode | string;
  layer_type: string;
  name: string;
  geometry: GeoJsonGeometry;
  metadata: Record<string, Json>;
};

/**
 * Dashboard view of a surge cluster (full_context §7.2–§9: clusters / hotspots).
 * Not a DB row in MVP; optional view model when the map layers incidents.
 */
export type SurgeCluster = {
  cluster_id: string;
  title: string;
  incident_count: number;
  /** e.g. { critical: 2, urgent: 5, non_emergency: 1 } */
  urgency_breakdown: Partial<Record<Urgency, number>>;
  summary: string;
  top_recommended_action: string | null;
  incident_ids: string[];
  /** Optional map hint — mock bbox or centroid is acceptable per plan. */
  center?: Coordinates | null;
};
