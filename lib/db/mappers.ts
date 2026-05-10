import type {
  CallSession,
  EventLayer,
  Incident,
  TranscriptEvent,
} from "@/lib/types/domain";
import type {
  AppMode,
  CallSessionStatus,
  LocationStatus,
  OperatorTransferStatus,
  Urgency,
} from "@/lib/types/enums";
import type { Coordinates, GeoJsonGeometry } from "@/lib/types/geo";
import type { Json } from "@/lib/types/json";

const asString = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v);

const parseJsonRecord = (v: unknown): Record<string, Json> => {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, Json>;
  return {};
};

const parseStringArray = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
};

const parseJsonArray = (v: unknown): Json[] => {
  if (Array.isArray(v)) return v as Json[];
  return [];
};

const parseCoordinates = (v: unknown): Coordinates | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const lat = o.lat;
  const lng = o.lng;
  if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  return null;
};

export const mapIncidentRow = (row: Record<string, unknown>): Incident => ({
  id: asString(row.id),
  public_id: row.public_id === null ? null : asString(row.public_id),
  created_at: asString(row.created_at),
  updated_at: asString(row.updated_at),
  mode: asString(row.mode) as AppMode,
  urgency: asString(row.urgency) as Urgency,
  incident_type: asString(row.incident_type),
  status: asString(row.status),
  operator_required:
    row.operator_required === null || row.operator_required === undefined
      ? null
      : Boolean(row.operator_required),
  assigned_operator:
    row.assigned_operator === null || row.assigned_operator === undefined
      ? null
      : asString(row.assigned_operator),
  control_state: asString(row.control_state),
  ai_active: Boolean(row.ai_active),
  location_status: asString(row.location_status) as LocationStatus,
  location_confidence:
    row.location_confidence === null || row.location_confidence === undefined
      ? null
      : Number(row.location_confidence),
  location:
    row.location === null || row.location === undefined
      ? null
      : asString(row.location),
  coordinates: parseCoordinates(row.coordinates),
  summary:
    row.summary === null || row.summary === undefined
      ? null
      : asString(row.summary),
  collected_fields: parseJsonRecord(row.collected_fields),
  missing_fields: parseStringArray(row.missing_fields),
  custom_fields: parseJsonArray(row.custom_fields),
  recommended_action:
    row.recommended_action === null || row.recommended_action === undefined
      ? null
      : asString(row.recommended_action),
  priority_score:
    row.priority_score === null || row.priority_score === undefined
      ? null
      : Number(row.priority_score),
  cluster_id:
    row.cluster_id === null || row.cluster_id === undefined
      ? null
      : asString(row.cluster_id),
  transcript_url:
    row.transcript_url === null || row.transcript_url === undefined
      ? null
      : asString(row.transcript_url),
  audio_url:
    row.audio_url === null || row.audio_url === undefined
      ? null
      : asString(row.audio_url),
  last_updated_by: asString(row.last_updated_by),
});

export const mapCallSessionRow = (row: Record<string, unknown>): CallSession => ({
  id: asString(row.id),
  incident_id: asString(row.incident_id),
  twilio_call_sid:
    row.twilio_call_sid === null || row.twilio_call_sid === undefined
      ? null
      : asString(row.twilio_call_sid),
  elevenlabs_conversation_id:
    row.elevenlabs_conversation_id === null ||
    row.elevenlabs_conversation_id === undefined
      ? null
      : asString(row.elevenlabs_conversation_id),
  caller_phone:
    row.caller_phone === null || row.caller_phone === undefined
      ? null
      : asString(row.caller_phone),
  status: asString(row.status) as CallSessionStatus,
  ai_active: Boolean(row.ai_active),
  turn_count: Number(row.turn_count ?? 0),
  recent_transcript: parseJsonArray(row.recent_transcript),
  required_fields: parseJsonArray(row.required_fields),
  missing_fields: parseStringArray(row.missing_fields),
  next_question:
    row.next_question === null || row.next_question === undefined
      ? null
      : asString(row.next_question),
  last_model_confidence:
    row.last_model_confidence === null || row.last_model_confidence === undefined
      ? null
      : Number(row.last_model_confidence),
  should_escalate: Boolean(row.should_escalate),
  operator_transfer_status: asString(
    row.operator_transfer_status
  ) as OperatorTransferStatus,
  created_at: asString(row.created_at),
  updated_at: asString(row.updated_at),
});

/** event_layers row → `EventLayer`. Geometry is stored as raw GeoJSON jsonb. */
export const mapEventLayerRow = (row: Record<string, unknown>): EventLayer => {
  const geometry =
    row.geometry && typeof row.geometry === "object"
      ? (row.geometry as GeoJsonGeometry)
      : ({ type: "Point", coordinates: [0, 0] } as GeoJsonGeometry);
  return {
    id: asString(row.id),
    mode: asString(row.mode),
    layer_type: asString(row.layer_type),
    name: asString(row.name),
    geometry,
    metadata: parseJsonRecord(row.metadata),
  };
};

export const mapTranscriptRow = (row: Record<string, unknown>): TranscriptEvent => ({
  id: asString(row.id),
  incident_id: asString(row.incident_id),
  call_session_id: asString(row.call_session_id),
  speaker: asString(row.speaker),
  text: asString(row.text),
  is_final: Boolean(row.is_final),
  language:
    row.language === null || row.language === undefined
      ? null
      : asString(row.language),
  translated_text:
    row.translated_text === null || row.translated_text === undefined
      ? null
      : asString(row.translated_text),
  created_at: asString(row.created_at),
});
