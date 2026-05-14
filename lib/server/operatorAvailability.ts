/**
 * Operator availability for transfer gating.
 * Set OPERATOR_AVAILABILITY=busy to keep AI on the line while still collecting details.
 */

import type { OperatorState } from "@/lib/dispatch/operatorAssignmentEngine";

export type OperatorAvailability = "free" | "busy";

export type AdvisoryOperatorStateResult = {
  operators: OperatorState[] | null;
  warning: string | null;
  source: "env" | "unavailable";
};

export const getOperatorAvailability = (): OperatorAvailability => {
  const raw = (process.env.OPERATOR_AVAILABILITY ?? "free")
    .toString()
    .trim()
    .toLowerCase();
  if (raw === "busy") return "busy";
  return "free";
};

export const getAdvisoryOperatorStates =
  (): AdvisoryOperatorStateResult => {
    const source = (process.env.OPERATOR_ASSIGNMENT_SOURCE ?? "env")
      .toString()
      .trim()
      .toLowerCase();

    if (source === "unavailable") {
      return {
        operators: null,
        warning: "operator_state_unavailable",
        source: "unavailable",
      };
    }

    const availability = getOperatorAvailability();
    return {
      operators: [
        {
          operator_id: "operator-1",
          name: "Primary Operator",
          status: availability,
          current_incident_id: availability === "busy" ? "active-incident" : null,
        },
      ],
      warning: null,
      source: "env",
    };
  };
