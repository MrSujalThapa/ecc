import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SystemAction } from "@/lib/ai/schemas/triageAgentOutputSchema";
import type { CallSession, Incident, TranscriptEvent } from "@/lib/types/domain";

const { repositoryCallTurn } = vi.hoisted(() => ({
  repositoryCallTurn: vi.fn(),
}));

vi.mock("@/lib/db/call-repository", () => ({
  repositoryCallTurn,
}));

import { runEmergencyTurn } from "./runEmergencyTurn";

const buildIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: "incident-1",
  public_id: "PUB-1",
  created_at: "2026-05-13T00:00:00.000Z",
  updated_at: "2026-05-13T00:00:00.000Z",
  mode: "normal",
  urgency: "unknown",
  incident_type: "unknown",
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
  last_updated_by: "system",
  ...overrides,
});

const buildCallSession = (
  overrides: Partial<CallSession> = {}
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
  created_at: "2026-05-13T00:00:00.000Z",
  updated_at: "2026-05-13T00:00:00.000Z",
  ...overrides,
});

const buildTranscriptEvent = (
  overrides: Partial<TranscriptEvent> = {}
): TranscriptEvent => ({
  id: "transcript-1",
  incident_id: "incident-1",
  call_session_id: "session-1",
  speaker: "caller",
  text: "Help",
  is_final: true,
  language: "en",
  translated_text: null,
  created_at: "2026-05-13T00:00:00.000Z",
  ...overrides,
});

const buildRepositoryResult = (overrides: {
  incident?: Partial<Incident>;
  call_session?: Partial<CallSession>;
  transcript_event?: Partial<TranscriptEvent>;
  actions?: SystemAction[];
  say_to_caller?: string | null;
  triage_trace?: null;
} = {}) => ({
  say_to_caller: overrides.say_to_caller ?? "Stay calm.",
  incident: buildIncident(overrides.incident),
  call_session: buildCallSession(overrides.call_session),
  transcript_event: buildTranscriptEvent(overrides.transcript_event),
  actions: overrides.actions ?? [],
  triage_trace: overrides.triage_trace ?? null,
});

describe("runEmergencyTurn", () => {
  beforeEach(() => {
    repositoryCallTurn.mockReset();
  });

  it("returns transfer_recommendation from transfer action and preserves fields", async () => {
    repositoryCallTurn.mockResolvedValue(
      buildRepositoryResult({
        actions: [
          {
            action: "transfer_to_operator",
            reason: "active_intruder",
          },
        ],
        incident: {
          urgency: "critical",
          operator_required: true,
        },
        call_session: {
          should_escalate: true,
          operator_transfer_status: "requested",
        },
      })
    );

    const result = await runEmergencyTurn({
      incident_id: "incident-1",
      call_session_id: "session-1",
      speaker: "caller",
      text: "Someone is inside.",
      is_final: true,
    });

    expect(result.transfer_recommendation).toEqual({
      recommended: true,
      reason: "active_intruder",
      source: "transfer_gate",
      urgency: "critical",
      operator_required: true,
      action_type: "transfer_to_operator",
    });
    expect(result.say_to_caller).toBe("Stay calm.");
    expect(result.incident.id).toBe("incident-1");
    expect(result.call_session.id).toBe("session-1");
    expect(result.actions).toHaveLength(1);
  });

  it("returns transfer_recommendation from gated session transfer state without action", async () => {
    repositoryCallTurn.mockResolvedValue(
      buildRepositoryResult({
        incident: {
          urgency: "urgent",
          operator_required: true,
        },
        call_session: {
          should_escalate: true,
          operator_transfer_status: "requested",
        },
      })
    );

    const result = await runEmergencyTurn({
      incident_id: "incident-1",
      call_session_id: "session-1",
      speaker: "caller",
      text: "I need help.",
      is_final: true,
    });

    expect(result.transfer_recommendation).toEqual({
      recommended: true,
      reason: "operator_required",
      source: "transfer_gate",
      urgency: "urgent",
      operator_required: true,
      action_type: undefined,
    });
  });

  it("returns triage-sourced transfer_recommendation from escalation signals", async () => {
    repositoryCallTurn.mockResolvedValue(
      buildRepositoryResult({
        incident: {
          urgency: "urgent",
          operator_required: true,
        },
        call_session: {
          should_escalate: true,
          operator_transfer_status: "not_requested",
        },
      })
    );

    const result = await runEmergencyTurn({
      incident_id: "incident-1",
      call_session_id: "session-1",
      speaker: "caller",
      text: "This feels unsafe.",
      is_final: true,
    });

    expect(result.transfer_recommendation).toEqual({
      recommended: true,
      reason: "operator_required",
      source: "triage",
      urgency: "urgent",
      operator_required: true,
      action_type: undefined,
    });
  });

  it("returns null transfer_recommendation when no transfer signals exist", async () => {
    repositoryCallTurn.mockResolvedValue(buildRepositoryResult());

    const result = await runEmergencyTurn({
      incident_id: "incident-1",
      call_session_id: "session-1",
      speaker: "caller",
      text: "There was a noise complaint.",
      is_final: true,
    });

    expect(result.transfer_recommendation).toBeNull();
  });

  it("propagates repository errors unchanged", async () => {
    const error = new Error("NOT_FOUND");
    repositoryCallTurn.mockRejectedValue(error);

    await expect(
      runEmergencyTurn({
        incident_id: "missing",
        call_session_id: "missing",
        speaker: "caller",
        text: "hello",
        is_final: true,
      })
    ).rejects.toBe(error);
  });
});
