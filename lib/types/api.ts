/**
 * HTTP API contracts aligned with `docs/api_contracts.md` (primary) and
 * `project_plan` / `project_details` for behavior notes.
 */

import type { CallTriageAgentProvider } from "@/lib/ai/agents/callTriageAgent";
import type {
  SystemAction,
  TriageToolRequest,
} from "@/lib/ai/schemas/triageAgentOutputSchema";
import type { ToolRequest, ToolResult } from "@/lib/ai/toolResults";
import type { AppMode, OperatorTransferStatus } from "./enums";
import type {
  CallSession,
  EventLayer,
  Incident,
  Responder,
  SurgeCluster,
  TranscriptEvent,
} from "./domain";

// --- POST /api/call/start ---

export type CallStartRequest = {
  mode?: AppMode;
  twilio_call_sid?: string | null;
  elevenlabs_conversation_id?: string | null;
  caller_phone?: string | null;
};

export type CallStartResponse = {
  incident_id: string;
  call_session_id: string;
  incident: Incident;
  call_session: CallSession;
};

// --- POST /api/call/turn ---

export type CallTurnRequest = {
  incident_id: string;
  call_session_id: string;
  speaker: string;
  text?: string;
  final_transcript?: string;
  is_final: boolean;
  language?: string | null;
  translated_text?: string | null;
  source?: "elevenlabs" | "twilio" | "simulate" | string;
};

/**
 * Diagnostic trace of the controlled two-pass tool loop in `repositoryCallTurn`.
 * `null` when no triage ran (e.g. partial transcripts) and otherwise mirrors the
 * audit-log `patch` shape produced by `buildTriageAuditPatch`.
 *
 * Useful for the dev simulator and end-to-end tests; production clients should
 * still treat `incident` / `call_session` / `say_to_caller` as the source of truth.
 */
export type TriageTrace = {
  passes: number;
  first_pass_tool_requests: TriageToolRequest[];
  normalized_tool_requests: ToolRequest[];
  tool_results: ToolResult[];
  second_pass_error: string | null;
  /** What the caller / `AI_PROVIDER` env asked for. */
  requested_provider: CallTriageAgentProvider;
  /** Provider that actually produced the first-pass output. */
  pass1_provider: CallTriageAgentProvider;
  /** Populated when the requested provider failed and we fell back to mock. */
  pass1_provider_error: string | null;
  /** `null` when the loop ran a single pass. */
  pass2_provider: CallTriageAgentProvider | null;
  pass2_provider_error: string | null;
};

export type CallTurnResponse = {
  say_to_caller: string | null;
  incident: Incident;
  call_session: CallSession;
  transcript_event: TranscriptEvent;
  actions: SystemAction[];
  triage_trace?: TriageTrace | null;
};

// --- POST /api/call/end ---

export type CallEndRequest = {
  incident_id: string;
  call_session_id: string;
  /** Preferred (`api_contracts`). */
  reason?: "completed" | "abandoned" | "transferred" | "operator_closed" | string;
  /** Legacy alias for `reason`. */
  outcome?: string;
};

export type CallEndResponse = {
  incident: Incident;
  call_session: CallSession;
};

// --- POST /api/operator/takeover ---

export type OperatorTakeoverRequest = {
  incident_id: string;
  operator_id: string;
};

export type OperatorTakeoverResponse = {
  incident: Incident;
  call_session: CallSession | null;
  transfer_status: OperatorTransferStatus;
};

// --- POST /api/operator/update-incident ---

export type OperatorUpdateIncidentRequest = {
  incident_id: string;
  operator_id: string;
  patch: Partial<
    Pick<
      Incident,
      | "urgency"
      | "incident_type"
      | "status"
      | "assigned_operator"
      | "control_state"
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
    >
  >;
};

export type OperatorUpdateIncidentResponse = {
  incident: Incident;
};

// --- POST /api/operator/resolve ---

export type OperatorResolveRequest = {
  incident_id: string;
  operator_id: string;
  resolution_note?: string | null;
};

export type OperatorResolveResponse = {
  incident: Incident;
  call_session: CallSession | null;
};

// --- POST /api/operator/send-sms ---

export type OperatorSendSmsRequest = {
  incident_id: string;
  operator_id: string;
  message: string;
  /** Optional override; otherwise backend uses latest session `caller_phone`. */
  to?: string | null;
};

export type OperatorSendSmsResponse = {
  incident_id: string;
  sent: boolean;
  provider_message_id?: string;
  error?: string;
};

// --- POST /api/simulate/disaster | world-cup ---

export type SimulateDisasterRequest = {
  count?: number;
  batch_size?: number;
  offset?: number;
  center?: { lat: number; lng: number };
  reset_existing?: boolean;
};

export type SimulateDisasterResponse = {
  created_incidents: Incident[];
  created_call_sessions: CallSession[];
  mode: "disaster";
};

export type SimulateWorldCupRequest = {
  count?: number;
  batch_size?: number;
  offset?: number;
  event_center?: { lat: number; lng: number };
  reset_existing?: boolean;
};

export type SimulateWorldCupResponse = {
  created_incidents: Incident[];
  created_call_sessions: CallSession[];
  event_layers: EventLayer[];
  mode: "world_cup";
};

// --- GET /api/responders/mock ---

export type RespondersMockResponse = {
  responders: Responder[];
};

// --- POST /api/surge/analyze (`docs/api_contracts.md` §4.11) ---

export type SurgeAnalyzeRequest = {
  mode: "disaster" | "world_cup";
  include_responders?: boolean;
  include_event_layers?: boolean;
};

export type SurgeAnalyzeResponse = {
  clusters: SurgeCluster[];
  updated_incidents: Incident[];
  top_priority_incident_ids: string[];
};
