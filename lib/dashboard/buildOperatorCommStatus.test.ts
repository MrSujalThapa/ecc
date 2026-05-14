import { describe, expect, it } from "vitest";
import type {
  CallSession,
  Incident,
  OperatorSendSmsResponse,
} from "@/lib/types";
import {
  buildSmsStatusView,
  buildTransferStatusView,
} from "./buildOperatorCommStatus";

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

const buildSmsResult = (
  overrides: Partial<OperatorSendSmsResponse> = {},
): OperatorSendSmsResponse => ({
  incident_id: "incident-1",
  sent: false,
  ...overrides,
});

describe("buildSmsStatusView", () => {
  it("shows missing recipient when caller phone is unavailable", () => {
    const status = buildSmsStatusView({
      incident: buildIncident(),
      activeCallSession: buildCallSession({ caller_phone: null }),
    });

    expect(status.recipientLabel).toBe("Caller phone missing");
    expect(status.deliveryValue).toBe("Recipient unavailable");
    expect(status.deliveryTone).toBe("warning");
  });

  it("shows success when the backend reports sent true", () => {
    const status = buildSmsStatusView({
      incident: buildIncident(),
      activeCallSession: buildCallSession({ caller_phone: "+14165550111" }),
      lastSmsResult: buildSmsResult({
        sent: true,
        provider_message_id: "SM123",
      }),
    });

    expect(status.deliveryValue).toBe("Sent");
    expect(status.deliveryTone).toBe("success");
    expect(status.deliveryHelp).toContain("SM123");
  });

  it("shows stub or not sent clearly when sent is false without an error", () => {
    const status = buildSmsStatusView({
      incident: buildIncident(),
      activeCallSession: buildCallSession({ caller_phone: "+14165550111" }),
      lastSmsResult: buildSmsResult({ sent: false }),
    });

    expect(status.deliveryValue).toBe("Not sent (provider stub or unavailable)");
    expect(status.deliveryTone).toBe("warning");
  });

  it("shows explicit error state when send sms returns an error", () => {
    const status = buildSmsStatusView({
      incident: buildIncident(),
      activeCallSession: buildCallSession({ caller_phone: "+14165550111" }),
      lastSmsResult: buildSmsResult({
        sent: false,
        error: "Twilio request failed",
      }),
    });

    expect(status.deliveryValue).toBe("Error");
    expect(status.deliveryTone).toBe("error");
    expect(status.deliveryHelp).toBe("Twilio request failed");
  });
});

describe("buildTransferStatusView", () => {
  it("reflects operator required, escalation, and transfer status", () => {
    const status = buildTransferStatusView({
      incident: buildIncident({ operator_required: true }),
      activeCallSession: buildCallSession({
        should_escalate: true,
        operator_transfer_status: "requested",
      }),
    });

    expect(status.operatorRequiredLabel).toBe("Operator required");
    expect(status.operatorRequiredTone).toBe("warning");
    expect(status.escalationLabel).toBe("Escalation flagged");
    expect(status.transferLabel).toBe("Transfer requested");
    expect(status.transferTone).toBe("warning");
  });

  it("does not claim completed transfer unless the session is explicitly transferred", () => {
    const requested = buildTransferStatusView({
      incident: buildIncident({ operator_required: true }),
      activeCallSession: buildCallSession({
        operator_transfer_status: "requested",
      }),
    });

    const transferred = buildTransferStatusView({
      incident: buildIncident({ operator_required: true }),
      activeCallSession: buildCallSession({
        operator_transfer_status: "transferred",
      }),
    });

    expect(requested.transferLabel).not.toBe("Transfer completed");
    expect(transferred.transferLabel).toBe("Transfer completed");
    expect(transferred.helpText).toContain("active session record");
  });
});
