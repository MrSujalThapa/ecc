import type { Incident } from "@/lib/types/domain";

export type OperatorState = {
  operator_id: string;
  name?: string;
  status: "free" | "busy" | "offline";
  current_incident_id?: string | null;
};

export type OperatorAssignment = {
  operator_id: string;
  incident_id: string;
  reason: string;
  priority_score: number;
};

export type IneligibleIncident = {
  incident_id: string;
  reason: string;
};

export type OperatorAssignmentResult = {
  assignments: OperatorAssignment[];
  queued_incidents: string[];
  unchanged_busy_operators: string[];
  ineligible_incidents: IneligibleIncident[];
};

export type BuildOperatorAssignmentsInput = {
  incidents: Incident[];
  operators: OperatorState[];
  now?: string | Date;
};

type EligibleIncident = {
  incident: Incident;
  priorityScore: number;
  reason: string;
  createdAtMs: number;
};

const URGENCY_WEIGHTS: Record<Incident["urgency"], number> = {
  critical: 1000,
  urgent: 700,
  unknown: 300,
  non_emergency: 100,
};

const parseTimeMs = (value: string | Date | undefined): number | null => {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const getWaitBoost = (createdAt: string, nowMs: number | null): number => {
  const createdAtMs = parseTimeMs(createdAt);
  if (createdAtMs === null || nowMs === null || nowMs <= createdAtMs) return 0;
  const waitMinutes = Math.floor((nowMs - createdAtMs) / 60_000);
  return Math.min(waitMinutes, 120);
};

const getLocationConfidenceBoost = (incident: Incident): number => {
  if (typeof incident.location_confidence !== "number") return 0;
  return Math.round(Math.max(0, Math.min(incident.location_confidence, 1)) * 20);
};

const getIneligibleReason = (incident: Incident): string | null => {
  if (incident.status === "resolved" || incident.status === "abandoned") {
    return "resolved_or_abandoned";
  }
  if (incident.assigned_operator) {
    return "already_assigned";
  }
  if (
    incident.operator_required !== true &&
    incident.status !== "transferring_to_operator"
  ) {
    return "operator_not_required";
  }
  return null;
};

const buildEligibleIncident = (
  incident: Incident,
  nowMs: number | null
): EligibleIncident => {
  const urgencyWeight = URGENCY_WEIGHTS[incident.urgency] ?? 0;
  const operatorRequiredBonus = incident.operator_required === true ? 200 : 0;
  const transferPendingBonus =
    incident.status === "transferring_to_operator" ? 100 : 0;
  const persistedPriority = incident.priority_score ?? 0;
  const waitBoost = getWaitBoost(incident.created_at, nowMs);
  const locationConfidenceBoost = getLocationConfidenceBoost(incident);

  const priorityScore =
    urgencyWeight +
    operatorRequiredBonus +
    transferPendingBonus +
    persistedPriority +
    waitBoost +
    locationConfidenceBoost;

  const reasons = [
    `${incident.urgency} urgency`,
    incident.operator_required === true ? "operator required" : null,
    incident.status === "transferring_to_operator" ? "transfer pending" : null,
    waitBoost > 0 ? `wait boost ${waitBoost}` : null,
    locationConfidenceBoost > 0
      ? `location confidence ${incident.location_confidence?.toFixed(2)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    incident,
    priorityScore,
    reason: reasons.join("; "),
    createdAtMs: parseTimeMs(incident.created_at) ?? Number.MAX_SAFE_INTEGER,
  };
};

export const buildOperatorAssignments = (
  input: BuildOperatorAssignmentsInput
): OperatorAssignmentResult => {
  const nowMs = parseTimeMs(input.now);
  const freeOperators = input.operators
    .filter((operator) => operator.status === "free")
    .sort((left, right) => left.operator_id.localeCompare(right.operator_id));

  const unchangedBusyOperators = input.operators
    .filter((operator) => operator.status === "busy")
    .map((operator) => operator.operator_id)
    .sort((left, right) => left.localeCompare(right));

  const ineligibleIncidents: IneligibleIncident[] = [];
  const eligibleIncidents: EligibleIncident[] = [];

  for (const incident of input.incidents) {
    const reason = getIneligibleReason(incident);
    if (reason) {
      ineligibleIncidents.push({
        incident_id: incident.id,
        reason,
      });
      continue;
    }
    eligibleIncidents.push(buildEligibleIncident(incident, nowMs));
  }

  eligibleIncidents.sort((left, right) => {
    if (right.priorityScore !== left.priorityScore) {
      return right.priorityScore - left.priorityScore;
    }
    if (left.createdAtMs !== right.createdAtMs) {
      return left.createdAtMs - right.createdAtMs;
    }
    return left.incident.id.localeCompare(right.incident.id);
  });

  const assignments: OperatorAssignment[] = [];
  const assignableCount = Math.min(freeOperators.length, eligibleIncidents.length);

  for (let index = 0; index < assignableCount; index += 1) {
    assignments.push({
      operator_id: freeOperators[index]!.operator_id,
      incident_id: eligibleIncidents[index]!.incident.id,
      reason: eligibleIncidents[index]!.reason,
      priority_score: eligibleIncidents[index]!.priorityScore,
    });
  }

  return {
    assignments,
    queued_incidents: eligibleIncidents
      .slice(assignableCount)
      .map((entry) => entry.incident.id),
    unchanged_busy_operators: unchangedBusyOperators,
    ineligible_incidents: ineligibleIncidents,
  };
};
