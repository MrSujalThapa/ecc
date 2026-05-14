import { describe, expect, it } from "vitest";
import type { CallSession, Incident } from "@/lib/types";
import { buildIncidentTimeline } from "./buildIncidentTimeline";

const buildIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: "incident-1",
  public_id: "INC-1",
  created_at: "2026-05-14T12:00:00.000Z",
  updated_at: "2026-05-14T12:30:00.000Z",
  mode: "normal",
  urgency: "urgent",
  incident_type: "medical",
  status: "active_call",
  operator_required: null,
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
  last_updated_by: "triage_agent",
  ...overrides,
});

const buildCallSession = (
  overrides: Partial<CallSession> = {},
): CallSession => ({
  id: "session-1",
  incident_id: "incident-1",
  twilio_call_sid: null,
  elevenlabs_conversation_id: null,
  caller_phone: null,
  status: "active",
  ai_active: true,
  turn_count: 1,
  recent_transcript: [],
  required_fields: [],
  missing_fields: [],
  next_question: null,
  last_model_confidence: null,
  should_escalate: false,
  operator_transfer_status: "not_requested",
  created_at: "2026-05-14T12:05:00.000Z",
  updated_at: "2026-05-14T12:20:00.000Z",
  ...overrides,
});

describe("buildIncidentTimeline", () => {
  it("creates created and updated events from incident timestamps", () => {
    const timeline = buildIncidentTimeline({
      incident: buildIncident(),
    });

    expect(timeline[0]).toMatchObject({
      label: "Incident created",
      timestamp: "2026-05-14T12:00:00.000Z",
      kind: "created",
      source: "incident",
    });
    expect(timeline).toContainEqual(
      expect.objectContaining({
        label: "Incident updated",
        timestamp: "2026-05-14T12:30:00.000Z",
        kind: "updated",
      }),
    );
  });

  it("includes status, urgency, operator, location, and recommendation events when available", () => {
    const timeline = buildIncidentTimeline({
      incident: buildIncident({
        operator_required: true,
        location_status: "confirmed_by_ai",
        location_confidence: 0.81,
        recommended_action: "Escalate after confirming breathing.",
        missing_fields: ["caller_name"],
        collected_fields: { symptoms: "chest pain" },
        priority_score: 88,
      }),
    });

    expect(timeline).toContainEqual(
      expect.objectContaining({
        label: "Current status",
        description: "active call",
      }),
    );
    expect(timeline).toContainEqual(
      expect.objectContaining({
        label: "Urgency and priority",
        description: expect.stringContaining("priority score 88"),
      }),
    );
    expect(timeline).toContainEqual(
      expect.objectContaining({
        label: "Location state available",
        kind: "location",
      }),
    );
    expect(timeline).toContainEqual(
      expect.objectContaining({
        label: "Operator requirement evaluated",
        description: "Operator involvement is currently recommended.",
      }),
    );
  });

  it("includes transfer, escalation, and next-question events from the active call session", () => {
    const timeline = buildIncidentTimeline({
      incident: buildIncident(),
      activeCallSession: buildCallSession({
        should_escalate: true,
        operator_transfer_status: "requested",
        next_question: "Are they breathing normally?",
      }),
    });

    expect(timeline).toContainEqual(
      expect.objectContaining({
        label: "Escalation flagged",
        source: "call_session",
      }),
    );
    expect(timeline).toContainEqual(
      expect.objectContaining({
        label: "Transfer status recorded",
        description: "requested",
      }),
    );
    expect(timeline).toContainEqual(
      expect.objectContaining({
        label: "Next AI question queued",
        description: "Are they breathing normally?",
      }),
    );
  });

  it("handles missing data without crashing and includes the honest unavailable note", () => {
    const timeline = buildIncidentTimeline({
      incident: buildIncident({
        operator_required: null,
        missing_fields: [],
        collected_fields: {},
        updated_at: "2026-05-14T12:00:00.000Z",
      }),
      activeCallSession: null,
    });

    expect(timeline).toContainEqual(
      expect.objectContaining({
        label: "Detailed tool trace unavailable",
        description: "Detailed tool timeline is not available in this drawer yet.",
        kind: "note",
        source: "derived",
      }),
    );
    expect(
      timeline.some(
        (item) =>
          item.description?.includes("Mapbox MCP") ||
          item.description?.includes("Featherless") ||
          item.description?.includes("Gemma"),
      ),
    ).toBe(false);
  });

  it("sorts events deterministically by timestamp and then fixed kind order", () => {
    const timeline = buildIncidentTimeline({
      incident: buildIncident({
        created_at: "2026-05-14T12:00:00.000Z",
        updated_at: "2026-05-14T13:00:00.000Z",
        operator_required: true,
      }),
      activeCallSession: buildCallSession({
        should_escalate: true,
        operator_transfer_status: "requested",
      }),
    });

    const createdIndex = timeline.findIndex((item) => item.label === "Incident created");
    const updatedIndex = timeline.findIndex((item) => item.label === "Incident updated");
    const statusIndex = timeline.findIndex((item) => item.label === "Current status");
    const noteIndex = timeline.findIndex(
      (item) => item.label === "Detailed tool trace unavailable",
    );

    expect(createdIndex).toBe(0);
    expect(updatedIndex).toBeGreaterThan(createdIndex);
    expect(statusIndex).toBeGreaterThan(createdIndex);
    expect(noteIndex).toBe(timeline.length - 1);
  });
});
