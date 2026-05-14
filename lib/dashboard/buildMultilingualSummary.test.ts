import { describe, expect, it } from "vitest";
import type { CallSession, Incident, TranscriptEvent } from "@/lib/types";
import { buildMultilingualSummary } from "./buildMultilingualSummary";

const buildIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: "incident-1",
  public_id: "INC-1",
  created_at: "2026-05-14T12:00:00.000Z",
  updated_at: "2026-05-14T12:00:00.000Z",
  mode: "world_cup",
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

const buildTranscriptEvent = (
  overrides: Partial<TranscriptEvent> = {},
): TranscriptEvent => ({
  id: "event-1",
  incident_id: "incident-1",
  call_session_id: "session-1",
  speaker: "caller",
  text: "Necesito ayuda",
  is_final: true,
  language: null,
  translated_text: null,
  created_at: "2026-05-14T12:01:00.000Z",
  ...overrides,
});

describe("buildMultilingualSummary", () => {
  it("returns an honest unavailable state when multilingual data is missing", () => {
    const summary = buildMultilingualSummary({
      incident: buildIncident(),
      activeCallSession: buildCallSession(),
    });

    expect(summary.details_available).toBe(false);
    expect(summary.translation_status.value).toBe("Unknown");
    expect(summary.notes).toContain(
      "Multilingual details not available for this incident yet.",
    );
  });

  it("shows caller language when an explicit transcript language is present", () => {
    const summary = buildMultilingualSummary({
      incident: buildIncident(),
      transcriptEvents: [
        buildTranscriptEvent({
          language: "es",
        }),
      ],
    });

    expect(summary.caller_language.value).toBe("Spanish (es)");
    expect(summary.details_available).toBe(true);
  });

  it("shows both original and english transcript values when translation exists", () => {
    const summary = buildMultilingualSummary({
      incident: buildIncident(),
      transcriptEvents: [
        buildTranscriptEvent({
          language: "es",
          text: "Necesito ayuda ahora",
          translated_text: "I need help now",
        }),
      ],
    });

    expect(summary.original_transcript.value).toBe("Necesito ayuda ahora");
    expect(summary.english_transcript.value).toBe("I need help now");
    expect(summary.translation_status.value).toBe("Available");
  });

  it("does not fake translation when only one transcript is available", () => {
    const summary = buildMultilingualSummary({
      incident: buildIncident({
        collected_fields: { caller_language: "fr" },
      }),
      transcriptEvents: [
        buildTranscriptEvent({
          text: "J'ai besoin d'aide",
          language: "fr",
          translated_text: null,
        }),
      ],
    });

    expect(summary.english_transcript.value).toBe(
      "No English translation is available in the loaded transcript events.",
    );
    expect(summary.translation_status.value).toBe("Unavailable");
  });

  it("does not claim IBM or watsonx usage when provider data is absent", () => {
    const summary = buildMultilingualSummary({
      incident: buildIncident(),
      transcriptEvents: [
        buildTranscriptEvent({
          language: "pt",
          translated_text: "Help is needed",
        }),
      ],
    });

    const allText = [
      summary.caller_language.value,
      summary.original_transcript.value,
      summary.english_transcript.value,
      summary.ai_reply_language.value,
      summary.operator_summary.value,
      summary.translation_status.value,
      ...summary.notes,
    ].join(" ");

    expect(allText).not.toContain("IBM");
    expect(allText).not.toContain("watsonx");
  });

  it("handles null and missing transcript/session data without crashing", () => {
    const summary = buildMultilingualSummary({
      incident: buildIncident(),
      activeCallSession: null,
      transcriptEvents: null,
    });

    expect(summary.caller_language.value).toBe("Not available");
    expect(summary.original_transcript.value).toBe(
      "Live transcript details not loaded in this view.",
    );
    expect(summary.ai_reply_language.value).toBe("Not available");
  });
});
