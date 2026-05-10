import type { TriageAgentOutput } from "@/lib/ai/schemas/triageAgentOutputSchema";
import type { CallSession, Incident } from "@/lib/types/domain";
import type { Json } from "@/lib/types/json";
import type { Urgency } from "@/lib/types/enums";
import {
  APP_MODES,
  LOCATION_STATUSES,
  URGENCY_LEVELS,
} from "@/lib/types/enums";
import { isoNow } from "./iso-now";

const mergeRecord = (
  base: Record<string, Json>,
  patch: Record<string, unknown> | undefined
): Record<string, Json> => {
  if (!patch) return base;
  const next = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    next[k] = v as Json;
  }
  return next;
};

const URGENCY_RANK: Record<Urgency, number> = {
  unknown: 0,
  non_emergency: 1,
  urgent: 2,
  critical: 3,
};

const AGENT_ALLOWED_INCIDENT_STATUS = new Set([
  "active_call",
  "collecting_location",
  "ai_handled",
]);

const AGENT_ALLOWED_CONTROL_STATE = new Set([
  "ai_leading",
  "ai_location_collection",
  "ai_completed",
]);

const voiceDebugEnabled = (): boolean => process.env.ECC_VOICE_DEBUG === "true";

const summarizeKeys = (value: unknown): string[] =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>).sort()
    : [];

const shortText = (value: unknown, maxLength = 120): string | null => {
  if (typeof value !== "string") return null;
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength
    ? `${compact.slice(0, maxLength)}...`
    : compact;
};

const voiceDebug = (
  stage: "after-ai" | "after-merge",
  payload: Record<string, unknown>
): void => {
  if (!voiceDebugEnabled()) return;
  console.info(`[ECC Voice Debug] ${stage}`, payload);
};

const isAppMode = (m: string): boolean =>
  APP_MODES.includes(m as (typeof APP_MODES)[number]);

const isLocationStatus = (s: string): boolean =>
  LOCATION_STATUSES.includes(s as (typeof LOCATION_STATUSES)[number]);

const mergeUrgency = (current: Urgency, proposed: unknown): Urgency => {
  if (typeof proposed !== "string") return current;
  if (!URGENCY_LEVELS.includes(proposed as Urgency)) return current;
  const next = proposed as Urgency;
  if (URGENCY_RANK[next] < URGENCY_RANK[current]) return current;
  return next;
};

/**
 * Merges triage `incident_patch` with server-side safety:
 * - urgency never downgrades on the discrete ladder
 * - status / control_state limited to operator-safe values (no human_active / transferring from the model)
 * - mode and location_status validated against enums
 * - `ai_active` is not applied from the agent (backend owns lifecycle)
 */
export const applyIncidentPatch = (
  incident: Incident,
  patch: TriageAgentOutput["incident_patch"]
): Incident => {
  voiceDebug("after-ai", {
    merge: "incident_patch",
    incident_id: incident.id,
    public_id: incident.public_id,
    incident_type_before: incident.incident_type,
    urgency_before: incident.urgency,
    location_before: shortText(incident.location, 100),
    collected_fields_keys_before: summarizeKeys(incident.collected_fields),
    missing_fields_before: incident.missing_fields,
    patch_urgency: patch.urgency ?? null,
    patch_incident_type: patch.incident_type ?? null,
    patch_location: shortText(patch.location, 100),
    patch_missing_fields: patch.missing_fields ?? null,
    patch_collected_fields_keys: summarizeKeys(patch.collected_fields),
  });

  const next: Incident = {
    ...incident,
    updated_at: isoNow(),
    last_updated_by: "triage_agent",
  };

  const entries = Object.entries(patch) as [
    keyof TriageAgentOutput["incident_patch"],
    unknown,
  ][];

  for (const [key, value] of entries) {
    if (value === undefined) continue;

    if (key === "collected_fields" && value && typeof value === "object") {
      next.collected_fields = mergeRecord(
        next.collected_fields,
        value as Record<string, unknown>
      );
      continue;
    }
    if (key === "missing_fields" && Array.isArray(value)) {
      next.missing_fields = value.filter((x): x is string => typeof x === "string");
      continue;
    }
    if (key === "mode") {
      if (typeof value === "string" && isAppMode(value)) {
        (next as Record<string, unknown>).mode = value;
      }
      continue;
    }
    if (key === "urgency") {
      next.urgency = mergeUrgency(next.urgency, value);
      continue;
    }
    if (key === "location_status") {
      if (typeof value === "string" && isLocationStatus(value)) {
        next.location_status = value as Incident["location_status"];
      }
      continue;
    }
    if (key === "status") {
      if (typeof value === "string" && AGENT_ALLOWED_INCIDENT_STATUS.has(value)) {
        next.status = value;
      }
      continue;
    }
    if (key === "control_state") {
      if (typeof value === "string" && AGENT_ALLOWED_CONTROL_STATE.has(value)) {
        next.control_state = value;
      }
      continue;
    }
    if (key === "ai_active") {
      continue;
    }
    if (key === "incident_type" && typeof value === "string") {
      next.incident_type = value;
      continue;
    }
    if (key === "operator_required" && typeof value === "boolean") {
      next.operator_required = value;
      continue;
    }
    if (key === "location_confidence" && typeof value === "number") {
      next.location_confidence = value;
      continue;
    }
    if (key === "location" && (typeof value === "string" || value === null)) {
      next.location = value;
      continue;
    }
    if (key === "coordinates") {
      if (
        value &&
        typeof value === "object" &&
        typeof (value as { lat?: unknown }).lat === "number" &&
        typeof (value as { lng?: unknown }).lng === "number"
      ) {
        next.coordinates = value as Incident["coordinates"];
      }
      continue;
    }
    if (key === "summary" && (typeof value === "string" || value === null)) {
      next.summary = value;
      continue;
    }
    if (key === "recommended_action" && (typeof value === "string" || value === null)) {
      next.recommended_action = value;
      continue;
    }
    if (key === "priority_score") {
      if (typeof value === "number" || value === null) next.priority_score = value;
      continue;
    }
    if (key === "cluster_id" && (typeof value === "string" || value === null)) {
      next.cluster_id = value;
      continue;
    }
  }

  voiceDebug("after-merge", {
    merge: "incident",
    incident_id: next.id,
    public_id: next.public_id,
    incident_type: next.incident_type,
    urgency: next.urgency,
    location: shortText(next.location, 100),
    collected_fields_keys: summarizeKeys(next.collected_fields),
    missing_fields: next.missing_fields,
  });

  return next;
};

/**
 * Merges triage `call_session_patch` with server-side safety.
 * Session lifecycle fields (`status`, `operator_transfer_status`, `ai_active`) are owned by the backend.
 */
export const applyCallSessionPatch = (
  session: CallSession,
  patch: TriageAgentOutput["call_session_patch"]
): CallSession => {
  voiceDebug("after-ai", {
    merge: "call_session_patch",
    call_session_id: session.id,
    incident_id: session.incident_id,
    previous_next_question: shortText(session.next_question),
    patch_next_question: shortText(patch.next_question),
    patch_should_escalate: patch.should_escalate ?? null,
  });

  const next: CallSession = { ...session, updated_at: isoNow() };
  const entries = Object.entries(patch) as [
    keyof TriageAgentOutput["call_session_patch"],
    unknown,
  ][];

  for (const [key, value] of entries) {
    if (value === undefined) continue;
    if (
      key === "status" ||
      key === "operator_transfer_status" ||
      key === "ai_active"
    ) {
      continue;
    }
    if (key === "turn_count" && typeof value === "number") {
      next.turn_count = value;
      continue;
    }
    if (key === "next_question") {
      if (value === null || typeof value === "string") next.next_question = value;
      continue;
    }
    if (key === "last_model_confidence") {
      if (typeof value === "number" || value === null) {
        next.last_model_confidence = value;
      }
      continue;
    }
    if (key === "should_escalate" && typeof value === "boolean") {
      next.should_escalate = value;
      continue;
    }
  }

  voiceDebug("after-merge", {
    merge: "call_session",
    call_session_id: next.id,
    incident_id: next.incident_id,
    next_question: shortText(next.next_question),
    should_escalate: next.should_escalate,
  });

  return next;
};

export const bumpTurnCount = (session: CallSession): CallSession => ({
  ...session,
  turn_count: session.turn_count + 1,
  updated_at: isoNow(),
});
