/**
 * Canonical string unions for the emergency operations platform.
 * Sourced from `project_details.md` (schema §12, agent output §14) and
 * `project_full_context_and_future_features.md` §1–§10 (modes, triage, tools, validation).
 * §11+ future ideas are not reflected here as separate contracts.
 *
 * Use these arrays with Zod `z.enum(...)` so runtime validation matches TypeScript.
 */

export const APP_MODES = ["normal", "disaster", "world_cup"] as const;
export type AppMode = (typeof APP_MODES)[number];

export const URGENCY_LEVELS = [
  "unknown",
  "non_emergency",
  "urgent",
  "critical",
] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

export const LOCATION_STATUSES = [
  "unknown",
  "approximate_by_ai",
  "confirmed_by_ai",
  "confirmed_by_operator",
] as const;
export type LocationStatus = (typeof LOCATION_STATUSES)[number];

/** Allowed system-side effects the triage agent may propose (backend executes after validation). */
export const TRIAGE_SYSTEM_ACTIONS = [
  "transfer_to_operator",
  "send_sms",
  "close_call_session",
  "none",
] as const;
export type TriageSystemAction = (typeof TRIAGE_SYSTEM_ACTIONS)[number];

export const CALL_SESSION_STATUSES = ["active", "closed"] as const;
export type CallSessionStatus = (typeof CALL_SESSION_STATUSES)[number];

export const OPERATOR_TRANSFER_STATUSES = [
  "not_requested",
  "requested",
  "transferred",
  "failed",
] as const;
export type OperatorTransferStatus = (typeof OPERATOR_TRANSFER_STATUSES)[number];

/**
 * Incident.status values used across docs workflows (SQL remains text; these are validated literals).
 */
export const INCIDENT_STATUSES = [
  "active_call",
  "collecting_location",
  "ai_handled",
  "transferring_to_operator",
  "human_active",
  "resolved",
  "abandoned",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const CONTROL_STATES = [
  "ai_leading",
  "ai_completed",
  "ai_location_collection",
  "transferring",
  "human_active",
] as const;
export type ControlState = (typeof CONTROL_STATES)[number];

/**
 * High-level triage outcome labels (docs/project_full_context §10.6).
 * Optional on agent output; useful for prompts, logging, and UI.
 */
export const TRIAGE_DECISIONS = [
  "continue_ai_handling",
  "complete_ai_report",
  "ask_location_then_escalate",
  "escalate_to_operator",
] as const;
export type TriageDecision = (typeof TRIAGE_DECISIONS)[number];

/** Registry of tools the Call Triage Agent may request (project_plan Main Step 6.3). */
export const TRIAGE_TOOL_NAMES = [
  "geocode_location",
  "event_zone_lookup",
  "responder_lookup",
  "sms_draft",
] as const;
export type TriageToolName = (typeof TRIAGE_TOOL_NAMES)[number];
