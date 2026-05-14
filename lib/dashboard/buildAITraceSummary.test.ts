import { describe, expect, it } from "vitest";
import type { CallSession, Incident } from "@/lib/types";
import { buildAITraceSummary } from "./buildAITraceSummary";

const buildIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: "incident-1",
  public_id: "INC-1",
  created_at: "2026-05-14T12:00:00.000Z",
  updated_at: "2026-05-14T12:00:00.000Z",
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
  source: undefined,
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
  created_at: "2026-05-14T12:00:00.000Z",
  updated_at: "2026-05-14T12:00:00.000Z",
  ...overrides,
});

describe("buildAITraceSummary", () => {
  it("renders honest unavailable state when session and optional trace data are missing", () => {
    const summary = buildAITraceSummary(buildIncident());

    expect(summary.recommendation).toContainEqual({
      label: "Recommended action",
      value: "No recommendation yet",
      tone: "default",
    });
    expect(summary.escalation).toContainEqual({
      label: "Transfer status",
      value: "Not available",
    });
    expect(summary.trace).toContainEqual({
      label: "Detailed runtime trace",
      value: "Not available in the dashboard drawer yet",
      tone: "default",
    });
  });

  it("renders available escalation, confidence, and recommendation fields when supplied", () => {
    const summary = buildAITraceSummary(
      buildIncident({
        recommended_action: "Escalate to human operator after confirming location.",
        operator_required: true,
        location_status: "confirmed_by_ai",
        location_confidence: 0.82,
        missing_fields: ["caller_name"],
        collected_fields: { location: "Union Station", symptoms: "chest pain" },
      }),
      buildCallSession({
        should_escalate: true,
        operator_transfer_status: "requested",
        next_question: "Are they breathing normally?",
        last_model_confidence: 0.73,
      }),
    );

    expect(summary.recommendation).toContainEqual({
      label: "Next AI question",
      value: "Are they breathing normally?",
    });
    expect(summary.escalation).toContainEqual({
      label: "Operator required",
      value: "Yes",
      tone: "warning",
    });
    expect(summary.escalation).toContainEqual({
      label: "Escalation flag",
      value: "Escalation recommended",
      tone: "warning",
    });
    expect(summary.confidence).toContainEqual({
      label: "Location confidence",
      value: "82%",
    });
    expect(summary.confidence).toContainEqual({
      label: "Model confidence",
      value: "73%",
    });
  });

  it("handles empty missing fields and collected fields without crashing", () => {
    const summary = buildAITraceSummary(
      buildIncident({
        missing_fields: [],
        collected_fields: {},
      }),
      buildCallSession(),
    );

    expect(summary.confidence).toContainEqual({
      label: "Missing fields",
      value: "No missing fields",
      tone: "default",
    });
    expect(summary.confidence).toContainEqual({
      label: "Collected fields",
      value: "None captured yet",
    });
  });
});
