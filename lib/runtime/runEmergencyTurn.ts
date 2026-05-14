import { repositoryCallTurn } from "@/lib/db/call-repository";
import {
  buildOperatorAssignments,
  type OperatorAssignmentResult as AdvisoryOperatorAssignmentResult,
} from "@/lib/dispatch/operatorAssignmentEngine";
import type { SystemAction } from "@/lib/ai/schemas/triageAgentOutputSchema";
import { getAdvisoryOperatorStates } from "@/lib/server/operatorAvailability";
import type { CallTurnRequest, TriageTrace } from "@/lib/types/api";
import type {
  CallSession,
  Incident,
  TranscriptEvent,
} from "@/lib/types/domain";

export type RuntimeAction = SystemAction;

export type TransferRecommendation = {
  recommended: boolean;
  reason: string;
  source: "triage" | "transfer_gate" | "runtime";
  urgency?: string;
  operator_required?: boolean;
  action_type?: string;
} | null;

export type OperatorAssignmentResult = AdvisoryOperatorAssignmentResult | null;

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
  validation_warnings: string[];
};

type RepositoryTurnResult = Awaited<ReturnType<typeof repositoryCallTurn>>;

const deriveTransferRecommendation = (
  result: RepositoryTurnResult
): TransferRecommendation => {
  const transferAction = result.actions.find(
    (action) => action.action === "transfer_to_operator"
  );
  const transferStatus = result.call_session.operator_transfer_status;
  const hasRequestedTransfer =
    transferStatus === "requested" || transferStatus === "transferring";
  const hasEscalationSignals =
    result.call_session.should_escalate === true &&
    result.incident.operator_required === true;

  if (!transferAction && !hasRequestedTransfer && !hasEscalationSignals) {
    return null;
  }

  return {
    recommended: true,
    reason:
      transferAction?.reason ??
      (result.incident.operator_required === true
        ? "operator_required"
        : "should_escalate"),
    source:
      transferAction || hasRequestedTransfer ? "transfer_gate" : "triage",
    urgency: result.incident.urgency,
    operator_required: result.incident.operator_required ?? undefined,
    action_type: transferAction?.action,
  };
};

const deriveOperatorAssignment = (
  result: RepositoryTurnResult,
  transferRecommendation: TransferRecommendation
): {
  operator_assignment: OperatorAssignmentResult;
  validation_warnings: string[];
} => {
  if (!transferRecommendation?.recommended) {
    return {
      operator_assignment: null,
      validation_warnings: [],
    };
  }

  const advisoryOperatorStates = getAdvisoryOperatorStates();
  if (!advisoryOperatorStates.operators) {
    return {
      operator_assignment: null,
      validation_warnings: advisoryOperatorStates.warning
        ? [advisoryOperatorStates.warning]
        : ["operator_state_unavailable"],
    };
  }

  return {
    operator_assignment: buildOperatorAssignments({
      incidents: [result.incident],
      operators: advisoryOperatorStates.operators,
      now: result.incident.updated_at,
    }),
    validation_warnings: advisoryOperatorStates.warning
      ? [advisoryOperatorStates.warning]
      : [],
  };
};

export const runEmergencyTurn = async (
  input: CallTurnRequest
): Promise<EmergencyTurnResult> => {
  const result = await repositoryCallTurn(input);
  const transferRecommendation = deriveTransferRecommendation(result);
  const assignmentOutcome = deriveOperatorAssignment(
    result,
    transferRecommendation
  );

  return {
    incident_id: result.incident.id,
    call_session_id: result.call_session.id,
    say_to_caller: result.say_to_caller,
    incident: result.incident,
    call_session: result.call_session,
    transcript_event: result.transcript_event,
    actions: result.actions,
    triage_trace: result.triage_trace,
    transfer_recommendation: transferRecommendation,
    operator_assignment: assignmentOutcome.operator_assignment,
    agent_trace_view: null,
    validation_warnings: assignmentOutcome.validation_warnings,
  };
};
