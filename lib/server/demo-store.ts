import type { AppMode } from "@/lib/types/enums";
import type {
  AuditLog,
  CallSession,
  Incident,
  TranscriptEvent,
} from "@/lib/types/domain";
import type { Json } from "@/lib/types/json";
import { isoNow } from "./iso-now";
import { newId } from "./ids";

type StoreState = {
  incidents: Map<string, Incident>;
  callSessions: Map<string, CallSession>;
  transcriptEvents: TranscriptEvent[];
  auditLogs: AuditLog[];
};

const state: StoreState = {
  incidents: new Map(),
  callSessions: new Map(),
  transcriptEvents: [],
  auditLogs: [],
};

export const createEmptyIncident = (mode: AppMode): Incident => {
  const id = newId();
  const t = isoNow();
  return {
    id,
    public_id: `INC-${id.slice(0, 8)}`,
    created_at: t,
    updated_at: t,
    mode,
    urgency: "unknown",
    incident_type: "unknown",
    status: "active_call",
    operator_required: null,
    assigned_operator: null,
    control_state: "ai_leading",
    ai_active: true,
    location_status: "unknown",
    location_confidence: null,
    location: null,
    coordinates: null,
    summary: null,
    collected_fields: {},
    missing_fields: [],
    custom_fields: [],
    recommended_action: null,
    priority_score: null,
    cluster_id: null,
    transcript_url: null,
    audio_url: null,
    last_updated_by: "system",
  };
};

export const createCallSessionForIncident = (
  incident: Incident,
  opts: {
    twilio_call_sid?: string | null;
    elevenlabs_conversation_id?: string | null;
    caller_phone?: string | null;
  } = {}
): CallSession => {
  const id = newId();
  const t = isoNow();
  const session: CallSession = {
    id,
    incident_id: incident.id,
    twilio_call_sid: opts.twilio_call_sid ?? null,
    elevenlabs_conversation_id: opts.elevenlabs_conversation_id ?? null,
    caller_phone: opts.caller_phone ?? null,
    status: "active",
    ai_active: true,
    turn_count: 0,
    recent_transcript: [],
    required_fields: [],
    missing_fields: [],
    next_question: null,
    last_model_confidence: null,
    should_escalate: false,
    operator_transfer_status: "not_requested",
    created_at: t,
    updated_at: t,
  };
  state.callSessions.set(session.id, session);
  state.incidents.set(incident.id, incident);
  return session;
};

export const getIncident = (id: string): Incident | undefined =>
  state.incidents.get(id);

/** Newest `created_at` first — used by dev operator sim and `/api/dev/incidents`. */
export const listAllIncidentsSorted = (): Incident[] =>
  [...state.incidents.values()].sort((a, b) => {
    const ac = a.created_at ?? "";
    const bc = b.created_at ?? "";
    if (ac < bc) return 1;
    if (ac > bc) return -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

export const getCallSession = (id: string): CallSession | undefined =>
  state.callSessions.get(id);

export const findActiveCallSessionForIncident = (
  incidentId: string
): CallSession | undefined => {
  let best: CallSession | undefined;
  for (const s of state.callSessions.values()) {
    if (s.incident_id !== incidentId || s.status !== "active") continue;
    if (!best || s.created_at > best.created_at) best = s;
  }
  return best;
};

/** All sessions for an incident, newest `updated_at` first (dev API + dashboard). */
export const listCallSessionsForIncidentSorted = (
  incidentId: string
): CallSession[] =>
  [...state.callSessions.values()]
    .filter((s) => s.incident_id === incidentId)
    .sort((a, b) =>
      a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0
    );

/** Newest `created_at` first — aligns with SMS recipient lookup on Supabase. */
export const listCallSessionsForIncidentByCreatedDesc = (
  incidentId: string
): CallSession[] =>
  [...state.callSessions.values()]
    .filter((s) => s.incident_id === incidentId)
    .sort((a, b) =>
      a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
    );

export const saveIncident = (incident: Incident): void => {
  state.incidents.set(incident.id, incident);
};

export const saveCallSession = (session: CallSession): void => {
  state.callSessions.set(session.id, session);
};

export const appendTranscriptEvent = (event: TranscriptEvent): void => {
  state.transcriptEvents.push(event);
  const session = state.callSessions.get(event.call_session_id);
  if (!session) return;
  const snippet: Json = {
    speaker: event.speaker,
    text: event.text,
    is_final: event.is_final,
    created_at: event.created_at,
  };
  const recent = [...session.recent_transcript, snippet].slice(-50);
  saveCallSession({
    ...session,
    recent_transcript: recent,
    updated_at: isoNow(),
  });
};

/** For simulate seeds: `recent_transcript` is already merged; only sync `transcriptEvents`. */
export const appendSeedTranscriptEvents = (events: TranscriptEvent[]): void => {
  state.transcriptEvents.push(...events);
};

export const getTranscriptHistoryForSession = (
  callSessionId: string
): TranscriptEvent[] =>
  state.transcriptEvents.filter((e) => e.call_session_id === callSessionId);

export const appendAuditLog = (log: AuditLog): void => {
  state.auditLogs.push(log);
};

export const newAuditLog = (input: {
  incident_id: string | null;
  actor: string;
  action: string;
  patch: Json | null;
}): AuditLog => {
  const log: AuditLog = {
    id: newId(),
    incident_id: input.incident_id,
    actor: input.actor,
    action: input.action,
    patch: input.patch,
    created_at: isoNow(),
  };
  appendAuditLog(log);
  return log;
};

/** Clears the in-memory store (used by Vitest and local demos). */
export const resetDemoStore = (): void => {
  state.incidents.clear();
  state.callSessions.clear();
  state.transcriptEvents.length = 0;
  state.auditLogs.length = 0;
};

/** Sizes for test assertions (no production callers intended). */
export const getDemoStoreSizes = (): { incidents: number; callSessions: number } => ({
  incidents: state.incidents.size,
  callSessions: state.callSessions.size,
});

/**
 * Read-only audit-log accessor for tests / dev tooling.
 * Filters by incident id and optionally by action.
 */
export const listAuditLogsForIncident = (
  incident_id: string,
  action?: string
): AuditLog[] =>
  state.auditLogs.filter(
    (l) => l.incident_id === incident_id && (action ? l.action === action : true)
  );
