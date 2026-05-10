/**
 * Lightweight transcript fixtures for the mock Call Triage Agent.
 *
 * These are NOT a test framework. They are simple, hand-written examples the
 * backend (or any teammate) can import to sanity-check the mock agent before
 * Featherless AI is connected. Each example pairs a transcript with the
 * urgency / incident_type / operator_required / should_escalate values the
 * keyword-matching mock is expected to produce, so backend integration code
 * can verify wiring end-to-end.
 *
 * Real Featherless AI will replace `mockCallTriageAgent`; the same expected
 * shape (TriageAgentOutput) will still apply, so these examples remain
 * useful as integration smoke checks even after the LLM is wired in.
 */

import type { AgentMode } from "../agents/types";

export interface MockTriageExpected {
  urgency: "unknown" | "non_emergency" | "urgent" | "critical";
  incident_type: string;
  operator_required: boolean;
  should_escalate: boolean;
}

export interface MockTriageExample {
  id: string;
  name: string;
  mode: AgentMode;
  latestTranscript: string;
  expected: MockTriageExpected;
}

export const mockTriageExamples: MockTriageExample[] = [
  {
    id: "ex-bike-theft-dana-porter",
    name: "Stolen bike near Dana Porter Library",
    mode: "normal",
    latestTranscript:
      "Someone stole my bike near Dana Porter Library.",
    expected: {
      urgency: "non_emergency",
      incident_type: "bike_theft",
      operator_required: false,
      should_escalate: false,
    },
  },
  {
    id: "ex-bike-theft-no-location",
    name: "Bike theft without location",
    mode: "normal",
    latestTranscript: "My bike was stolen.",
    expected: {
      urgency: "non_emergency",
      incident_type: "bike_theft",
      operator_required: false,
      should_escalate: false,
    },
  },
  {
    id: "ex-active-break-in",
    name: "Active break-in",
    mode: "normal",
    latestTranscript:
      "Someone broke into my house, I can hear them downstairs right now.",
    expected: {
      urgency: "critical",
      incident_type: "active_break_in",
      operator_required: true,
      should_escalate: true,
    },
  },
  {
    id: "ex-medical-collapse",
    name: "Medical collapse / unconscious caller",
    mode: "normal",
    latestTranscript:
      "My grandfather just collapsed and is unconscious, please help.",
    expected: {
      urgency: "critical",
      incident_type: "medical_emergency",
      operator_required: true,
      should_escalate: true,
    },
  },
  {
    id: "ex-gas-smell-after-earthquake",
    name: "Gas smell after earthquake",
    mode: "disaster",
    latestTranscript:
      "There is a strong gas smell in my building after the earthquake.",
    expected: {
      urgency: "critical",
      incident_type: "gas_leak",
      operator_required: true,
      should_escalate: true,
    },
  },
  {
    id: "ex-lost-child-fan-zone",
    name: "Lost child near fan zone",
    mode: "world_cup",
    latestTranscript:
      "I lost my child near the fan zone, I can't find him anywhere.",
    expected: {
      urgency: "critical",
      incident_type: "missing_person",
      operator_required: true,
      should_escalate: true,
    },
  },
  {
    id: "ex-crowd-pushing-stadium-gate",
    name: "Crowd pushing near stadium gate",
    mode: "world_cup",
    latestTranscript:
      "The crowd is pushing really hard near the stadium gate, people are getting hurt.",
    expected: {
      urgency: "urgent",
      incident_type: "crowd_surge",
      operator_required: true,
      should_escalate: true,
    },
  },
  {
    id: "ex-lost-item-laptop",
    name: "Lost item (laptop on bus)",
    mode: "normal",
    latestTranscript: "I lost my laptop on the bus this morning.",
    expected: {
      urgency: "non_emergency",
      incident_type: "lost_item",
      operator_required: false,
      should_escalate: false,
    },
  },
  {
    id: "ex-unclear-caller-message",
    name: "Unclear caller message",
    mode: "normal",
    latestTranscript: "Hello? Um... I'm not really sure what to say.",
    expected: {
      urgency: "unknown",
      incident_type: "unknown",
      operator_required: false,
      should_escalate: false,
    },
  },
];

export default mockTriageExamples;
