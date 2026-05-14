import { repositoryCallTurn } from "@/lib/db/call-repository";
import type { SystemAction } from "@/lib/ai/schemas/triageAgentOutputSchema";
import type { CallTurnRequest, TriageTrace } from "@/lib/types/api";
import type {
  CallSession,
  Incident,
  TranscriptEvent,
} from "@/lib/types/domain";

export type RuntimeAction = SystemAction;

export type TransferRecommendation = null;

export type OperatorAssignmentResult = null;

export type AgentTraceView = null;

export type EmergencyTurnResult = {
  incident_id: string;
  call_session_id: string;
  say_to_caller: string | null;
  incident: Incident;
  call_session: CallSession;
  transcript_event: TranscriptEvent;
  actions: RuntimeAction[];
  triage_trace: TriageTrace | null;
  transfer_recommendation: TransferRecommendation;
  operator_assignment: OperatorAssignmentResult;
  agent_trace_view: AgentTraceView;
  validation_warnings: [];
};

export const runEmergencyTurn = async (
  input: CallTurnRequest
): Promise<EmergencyTurnResult> => {
  const result = await repositoryCallTurn(input);

  return {
    incident_id: result.incident.id,
    call_session_id: result.call_session.id,
    say_to_caller: result.say_to_caller,
    incident: result.incident,
    call_session: result.call_session,
    transcript_event: result.transcript_event,
    actions: result.actions,
    triage_trace: result.triage_trace,
    transfer_recommendation: null,
    operator_assignment: null,
    agent_trace_view: null,
    validation_warnings: [],
  };
};
