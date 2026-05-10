import type { SystemAction } from "@/lib/ai/schemas/triageAgentOutputSchema";
import type { CallSession, Incident } from "@/lib/types/domain";
import type { AppMode } from "@/lib/types/enums";
import { getOperatorAvailability } from "@/lib/server/operatorAvailability";

const hasNonEmptyLocationText = (location: string | null): boolean =>
  Boolean(location && location.trim().length > 0);

/**
 * Location is “known” enough to allow an operator bridge when other gates pass.
 */
export const isLocationKnownForTransfer = (incident: Incident): boolean => {
  if (incident.location_status === "unknown") return false;
  if (incident.coordinates) return true;
  return hasNonEmptyLocationText(incident.location);
};

const filterTransferActions = (actions: SystemAction[]): SystemAction[] =>
  actions.filter((a) => a.action !== "transfer_to_operator");

const ensureTransferAction = (actions: SystemAction[]): SystemAction[] => {
  if (actions.some((a) => a.action === "transfer_to_operator")) return actions;
  return [
    ...actions,
    {
      action: "transfer_to_operator" as const,
      reason: "operator_required",
    },
  ];
};

export type TransferGateResult = {
  incident: Incident;
  call_session: CallSession;
  actions: SystemAction[];
  /** True when the live call should be bridged to the operator number. */
  transferApproved: boolean;
  /** Model or flags asked for operator / transfer (used for audit only). */
  hadOperatorTransferIntent: boolean;
  /** Populated when transfer was requested but not executed (audit / logging). */
  suppressionReason:
    | null
    | "location_unknown"
    | "mode_not_normal"
    | "operator_busy";
};

/**
 * Applies backend transfer policy after triage patches are merged.
 * The model may request transfer via `system_actions` and/or `operator_required`.
 */
export const applyTransferGate = (
  incident: Incident,
  callSession: CallSession,
  systemActions: SystemAction[]
): TransferGateResult => {
  const hasTransferAction = systemActions.some(
    (a) => a.action === "transfer_to_operator"
  );
  const operatorRequired = incident.operator_required === true;

  const hadOperatorTransferIntent =
    hasTransferAction || operatorRequired;

  if (!hadOperatorTransferIntent) {
    return {
      incident,
      call_session: callSession,
      actions: filterTransferActions(systemActions),
      transferApproved: false,
      hadOperatorTransferIntent: false,
      suppressionReason: null,
    };
  }

  if (!isLocationKnownForTransfer(incident)) {
    return {
      incident,
      call_session: {
        ...callSession,
        should_escalate: false,
        operator_transfer_status: "not_requested",
      },
      actions: filterTransferActions(systemActions),
      transferApproved: false,
      hadOperatorTransferIntent: true,
      suppressionReason: "location_unknown",
    };
  }

  const mode = incident.mode as AppMode;
  if (mode !== "normal") {
    return {
      incident,
      call_session: {
        ...callSession,
        should_escalate: false,
        operator_transfer_status: "not_requested",
      },
      actions: filterTransferActions(systemActions),
      transferApproved: false,
      hadOperatorTransferIntent: true,
      suppressionReason: "mode_not_normal",
    };
  }

  if (getOperatorAvailability() !== "free") {
    return {
      incident,
      call_session: {
        ...callSession,
        should_escalate: false,
        operator_transfer_status: "not_requested",
      },
      actions: filterTransferActions(systemActions),
      transferApproved: false,
      hadOperatorTransferIntent: true,
      suppressionReason: "operator_busy",
    };
  }

  const nextIncident: Incident = {
    ...incident,
    status: "transferring_to_operator",
    control_state: "transferring",
  };

  const nextSession: CallSession = {
    ...callSession,
    should_escalate: true,
    operator_transfer_status: "requested",
  };

  return {
    incident: nextIncident,
    call_session: nextSession,
    actions: ensureTransferAction(systemActions),
    transferApproved: true,
    hadOperatorTransferIntent: true,
    suppressionReason: null,
  };
};
