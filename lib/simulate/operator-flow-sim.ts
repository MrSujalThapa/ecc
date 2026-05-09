import type {
  OperatorResolveRequest,
  OperatorSendSmsRequest,
  OperatorTakeoverRequest,
  OperatorUpdateIncidentRequest,
} from "@/lib/types/api";

/**
 * Fixed operator id for dev/E2E so audit logs and `assigned_operator` are easy to spot.
 * Not a real auth principal — same idea as voice sim synthetic Twilio/ElevenLabs ids.
 */
export const OPERATOR_SIM_OPERATOR_ID = "OP-SIM" as const;

export const buildOperatorSimTakeover = (
  incident_id: string,
  operator_id: string = OPERATOR_SIM_OPERATOR_ID
): OperatorTakeoverRequest => ({
  incident_id,
  operator_id,
});

export const buildOperatorSimUpdateSummary = (
  incident_id: string,
  summary: string,
  operator_id: string = OPERATOR_SIM_OPERATOR_ID
): OperatorUpdateIncidentRequest => ({
  incident_id,
  operator_id,
  patch: { summary },
});

export const buildOperatorSimResolve = (
  incident_id: string,
  resolution_note?: string | null,
  operator_id: string = OPERATOR_SIM_OPERATOR_ID
): OperatorResolveRequest => ({
  incident_id,
  operator_id,
  resolution_note: resolution_note ?? undefined,
});

export const buildOperatorSimSendSms = (
  incident_id: string,
  message: string,
  operator_id: string = OPERATOR_SIM_OPERATOR_ID
): OperatorSendSmsRequest => ({
  incident_id,
  operator_id,
  message,
});
