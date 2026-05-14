import { describe, expect, it } from "vitest";
import { buildOperatorAssignments, type OperatorState } from "./operatorAssignmentEngine";
import type { Incident } from "@/lib/types/domain";

const buildIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: "incident-1",
  public_id: "INC-1",
  created_at: "2026-05-14T12:00:00.000Z",
  updated_at: "2026-05-14T12:00:00.000Z",
  mode: "normal",
  urgency: "unknown",
  incident_type: "unknown",
  status: "active_call",
  operator_required: true,
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
  ...overrides,
});

const buildOperator = (overrides: Partial<OperatorState> = {}): OperatorState => ({
  operator_id: "op-1",
  status: "free",
  current_incident_id: null,
  ...overrides,
});

describe("buildOperatorAssignments", () => {
  it("assigns one free operator to the highest-priority waiting incident", () => {
    const result = buildOperatorAssignments({
      incidents: [
        buildIncident({ id: "low", urgency: "urgent" }),
        buildIncident({ id: "high", urgency: "critical" }),
      ],
      operators: [buildOperator()],
      now: "2026-05-14T13:00:00.000Z",
    });

    expect(result.assignments).toEqual([
      expect.objectContaining({
        operator_id: "op-1",
        incident_id: "high",
      }),
    ]);
    expect(result.queued_incidents).toEqual(["low"]);
  });

  it("does not interrupt busy operators and ignores offline operators", () => {
    const result = buildOperatorAssignments({
      incidents: [buildIncident({ id: "incident-1", urgency: "critical" })],
      operators: [
        buildOperator({ operator_id: "op-busy", status: "busy", current_incident_id: "active-1" }),
        buildOperator({ operator_id: "op-offline", status: "offline" }),
      ],
      now: "2026-05-14T13:00:00.000Z",
    });

    expect(result.assignments).toEqual([]);
    expect(result.queued_incidents).toEqual(["incident-1"]);
    expect(result.unchanged_busy_operators).toEqual(["op-busy"]);
  });

  it("skips already assigned incidents", () => {
    const result = buildOperatorAssignments({
      incidents: [
        buildIncident({ id: "assigned", assigned_operator: "op-9" }),
        buildIncident({ id: "waiting", urgency: "critical" }),
      ],
      operators: [buildOperator()],
      now: "2026-05-14T13:00:00.000Z",
    });

    expect(result.assignments[0]?.incident_id).toBe("waiting");
    expect(result.ineligible_incidents).toContainEqual({
      incident_id: "assigned",
      reason: "already_assigned",
    });
  });

  it("skips resolved and abandoned incidents", () => {
    const result = buildOperatorAssignments({
      incidents: [
        buildIncident({ id: "resolved", status: "resolved" }),
        buildIncident({ id: "abandoned", status: "abandoned" }),
        buildIncident({ id: "waiting", urgency: "urgent" }),
      ],
      operators: [buildOperator()],
      now: "2026-05-14T13:00:00.000Z",
    });

    expect(result.assignments[0]?.incident_id).toBe("waiting");
    expect(result.ineligible_incidents).toEqual(
      expect.arrayContaining([
        { incident_id: "resolved", reason: "resolved_or_abandoned" },
        { incident_id: "abandoned", reason: "resolved_or_abandoned" },
      ])
    );
  });

  it("skips incidents without operator need by default", () => {
    const result = buildOperatorAssignments({
      incidents: [
        buildIncident({ id: "not-needed", operator_required: false }),
      ],
      operators: [buildOperator()],
      now: "2026-05-14T13:00:00.000Z",
    });

    expect(result.assignments).toEqual([]);
    expect(result.queued_incidents).toEqual([]);
    expect(result.ineligible_incidents).toEqual([
      { incident_id: "not-needed", reason: "operator_not_required" },
    ]);
  });

  it("assigns multiple free operators to top-ranked incidents in order", () => {
    const result = buildOperatorAssignments({
      incidents: [
        buildIncident({ id: "incident-b", urgency: "urgent" }),
        buildIncident({ id: "incident-a", urgency: "critical" }),
        buildIncident({ id: "incident-c", urgency: "unknown" }),
      ],
      operators: [
        buildOperator({ operator_id: "op-2" }),
        buildOperator({ operator_id: "op-1" }),
      ],
      now: "2026-05-14T13:00:00.000Z",
    });

    expect(result.assignments).toEqual([
      expect.objectContaining({ operator_id: "op-1", incident_id: "incident-a" }),
      expect.objectContaining({ operator_id: "op-2", incident_id: "incident-b" }),
    ]);
    expect(result.queued_incidents).toEqual(["incident-c"]);
  });

  it("returns no assignments when there are no eligible incidents", () => {
    const result = buildOperatorAssignments({
      incidents: [],
      operators: [buildOperator()],
      now: "2026-05-14T13:00:00.000Z",
    });

    expect(result.assignments).toEqual([]);
    expect(result.queued_incidents).toEqual([]);
  });

  it("uses wait time as a deterministic tie-breaker", () => {
    const result = buildOperatorAssignments({
      incidents: [
        buildIncident({
          id: "older",
          urgency: "urgent",
          created_at: "2026-05-14T11:00:00.000Z",
        }),
        buildIncident({
          id: "newer",
          urgency: "urgent",
          created_at: "2026-05-14T12:30:00.000Z",
        }),
      ],
      operators: [buildOperator()],
      now: "2026-05-14T13:00:00.000Z",
    });

    expect(result.assignments[0]?.incident_id).toBe("older");
    expect(result.queued_incidents).toEqual(["newer"]);
  });

  it("includes deterministic assignment reasons", () => {
    const result = buildOperatorAssignments({
      incidents: [
        buildIncident({
          id: "reasoned",
          urgency: "critical",
          location_confidence: 0.9,
          created_at: "2026-05-14T11:00:00.000Z",
          status: "transferring_to_operator",
        }),
      ],
      operators: [buildOperator()],
      now: "2026-05-14T13:00:00.000Z",
    });

    expect(result.assignments[0]?.reason).toContain("critical urgency");
    expect(result.assignments[0]?.reason).toContain("operator required");
    expect(result.assignments[0]?.reason).toContain("transfer pending");
  });
});
