/**
 * Mock Call Triage Agent.
 *
 * This is a deterministic, keyword-driven stand-in for the real Featherless
 * LLM-backed Call Triage Agent. It exists so the backend can wire and test
 * the full call/turn pipeline (incident creation, validation, dashboard
 * updates, transfer logic) before Featherless is connected.
 *
 * Important rules this file follows:
 *   - It does NOT touch the database, Twilio, ElevenLabs, Supabase, Mapbox,
 *     or any external API.
 *   - It only returns a schema-valid TriageAgentOutput; the backend is
 *     responsible for validating, merging, and executing.
 *   - Output is validated via `validateTriageAgentOutput` before returning,
 *     so any future change to the schema will surface here immediately.
 *   - `system_actions` is intentionally left empty in this mock phase. The
 *     backend should not perform real transfers based on mock output.
 */

import {
  validateTriageAgentOutput,
  type TriageAgentOutput,
  type TriageToolRequest,
} from "../schemas/triageAgentOutputSchema";
import type { GeocodeLocationData, ToolResult } from "../toolResults";
import type {
  AgentMode,
  CallTriageAgentInput,
  TranscriptLike,
} from "./types";

function extractText(t: TranscriptLike | undefined | null): string {
  if (!t) return "";
  if (typeof t === "string") return t;
  if (typeof t === "object") {
    if (typeof t.final_transcript === "string") return t.final_transcript;
    if (typeof t.text === "string") return t.text;
  }
  return "";
}

function matchesAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

const KEYWORDS = {
  bikeTheft: [
    "stolen bike",
    "bike theft",
    "stole my bike",
    "my bike was stolen",
    "someone stole my bike",
  ],
  stolenItem: [
    "stolen item",
    "stole my",
    "someone stole",
    "got stolen",
  ],
  activeBreakIn: [
    "broke into",
    "broke in",
    "break-in",
    "break in",
    "breaking in",
    "intruder in",
    "someone in my house",
  ],
  medical: [
    "unconscious",
    "passed out",
    "collapsed",
    "not breathing",
    "no pulse",
    "medical collapse",
    "heart attack",
    "having a stroke",
  ],
  gasLeak: ["gas smell", "smell gas", "smell of gas", "gas leak"],
  fire: ["fire", "smoke", "flames", "burning", "house on fire", "building on fire", "on fire"],
  trapped: [
    "trapped",
    "stuck inside",
    "can't get out",
    "cannot get out",
    "trapped person",
  ],
  missingPerson: [
    "lost child",
    "missing child",
    "missing person",
    "can't find my child",
    "cannot find my child",
    "missing kid",
    "lost my child",
  ],
  lostItem: [
    "lost my",
    "lost item",
    "i lost",
    "lost laptop",
    "lost wallet",
    "lost phone",
    "lost bag",
    "lost my keys",
  ],
  crowdSurge: [
    "crowd pushing",
    "crowd surge",
    "crowd is pushing",
    "stadium crowd",
    "stampede",
    "people getting crushed",
    "crushed by crowd",
  ],
  geocodingDemo: [
    "demo geocode",
    "geocode demo",
    "geocoding demo",
    "demo: geocode",
  ],
} as const;

const DANA_PORTER_PHRASES = [
  "near dana porter library",
  "dana porter library",
];

const DANA_PORTER_OVERLAY = {
  location: "Dana Porter Library",
  location_status: "approximate_by_ai" as const,
  location_confidence: 0.86,
  coordinates: { lat: 43.4699, lng: -80.5424 },
};

function applyDanaPorter(
  transcript: string,
  incidentPatch: Record<string, unknown>
): void {
  if (DANA_PORTER_PHRASES.some((p) => transcript.includes(p))) {
    Object.assign(incidentPatch, DANA_PORTER_OVERLAY);
  }
}

type RawDraft = {
  tool_requests: TriageToolRequest[];
  incident_patch: Record<string, unknown>;
  call_session_patch: Record<string, unknown>;
  system_actions: never[];
  say_to_caller: string;
};

const DEFAULT_DEMO_LOCATION = "Dana Porter Library";

const GEOCODING_DEMO_PREPOSITIONS = [" at ", " near ", " for ", " of "] as const;

const extractDemoLocationText = (transcript: string): string => {
  const trigger = KEYWORDS.geocodingDemo.find((k) => transcript.includes(k));
  if (!trigger) return DEFAULT_DEMO_LOCATION;
  const after = transcript.split(trigger)[1] ?? "";
  if (!after.trim()) return DEFAULT_DEMO_LOCATION;
  let tail = after;
  for (const prep of GEOCODING_DEMO_PREPOSITIONS) {
    if (tail.startsWith(prep)) {
      tail = tail.slice(prep.length);
      break;
    }
  }
  const cleaned = tail
    .replace(/^[\s:,-]+/u, "")
    .split(/[.?!]/u)[0]
    ?.trim();
  return cleaned && cleaned.length > 0 ? cleaned : DEFAULT_DEMO_LOCATION;
};

const findToolResult = <T>(
  toolResults: readonly ToolResult[] | undefined,
  toolName: string
): ToolResult<T> | undefined => {
  if (!toolResults) return undefined;
  return toolResults.find(
    (r) => r.tool === toolName && r.ok
  ) as ToolResult<T> | undefined;
};

const geocodingDemoFirstPassDraft = (
  transcript: string,
  mode: AgentMode
): RawDraft => {
  const locationText = extractDemoLocationText(transcript);
  const tool_requests: TriageToolRequest[] = [
    {
      tool: "geocode_location",
      args: { location_text: locationText },
      reason:
        "Demo: resolve caller-provided landmark to coordinates before confirming.",
    },
  ];
  const next_question = "One moment while I look that up.";
  return {
    tool_requests,
    incident_patch: {
      mode,
      urgency: "non_emergency",
      incident_type: "geocoding_demo",
      operator_required: false,
      status: "active_call",
      control_state: "ai_leading",
      ai_active: true,
      location: locationText,
      location_status: "unknown",
      summary: `Demo: geocoding caller-provided location "${locationText}".`,
      collected_fields: { demo_location_text: locationText },
      missing_fields: ["coordinates"],
      recommended_action:
        "Resolve location via geocode_location, then confirm with caller.",
    },
    call_session_patch: {
      status: "active",
      ai_active: true,
      next_question,
      should_escalate: false,
    },
    system_actions: [],
    say_to_caller: next_question,
  };
};

const geocodingDemoSecondPassDraft = (
  transcript: string,
  mode: AgentMode,
  toolResults: readonly ToolResult[]
): RawDraft => {
  const requested = extractDemoLocationText(transcript);
  const geocode = findToolResult<GeocodeLocationData>(
    toolResults,
    "geocode_location"
  );

  const incident_patch: Record<string, unknown> = {
    mode,
    urgency: "non_emergency",
    incident_type: "geocoding_demo",
    operator_required: false,
    status: "active_call",
    control_state: "ai_leading",
    ai_active: true,
    collected_fields: {
      demo_location_text: requested,
      tool_passes: 2,
    },
    missing_fields: [],
  };

  let confirmedLabel = requested;
  if (geocode?.data) {
    const { coordinates, normalized_location, confidence } = geocode.data;
    confirmedLabel = normalized_location;
    incident_patch.location = normalized_location;
    incident_patch.coordinates = coordinates;
    incident_patch.location_status = "approximate_by_ai";
    incident_patch.location_confidence = confidence;
    incident_patch.summary = `Demo: geocoded "${requested}" to ${normalized_location} (confidence ${confidence.toFixed(2)}).`;
  } else {
    incident_patch.location = requested;
    incident_patch.location_status = "unknown";
    incident_patch.summary = `Demo: geocode_location did not return a usable result for "${requested}".`;
  }

  incident_patch.recommended_action =
    "Confirm geocoded location with caller.";

  const next_question = geocode?.data
    ? `I think you mean ${confirmedLabel}. Is that correct?`
    : "I could not resolve that location. Could you describe it differently?";

  return {
    tool_requests: [],
    incident_patch,
    call_session_patch: {
      status: "active",
      ai_active: true,
      next_question,
      should_escalate: false,
    },
    system_actions: [],
    say_to_caller: next_question,
  };
};

function theftDraft(
  transcript: string,
  mode: AgentMode,
  isBike: boolean
): RawDraft {
  const incidentType = isBike ? "bike_theft" : "theft_report";
  const next_question = isBike
    ? "Can you describe the bike and when it was stolen?"
    : "Can you describe the stolen item and when it was taken?";
  const summary = isBike
    ? "Caller reports a stolen bike. No immediate danger reported."
    : "Caller reports a stolen item. No immediate danger reported.";
  const incident_patch: Record<string, unknown> = {
    mode,
    urgency: "non_emergency",
    incident_type: incidentType,
    operator_required: false,
    status: "active_call",
    control_state: "ai_leading",
    ai_active: true,
    summary,
    collected_fields: isBike ? { item: "bike" } : {},
    missing_fields: [
      "item_description",
      "time_of_theft",
      "suspect_seen",
      "callback_number",
    ],
    recommended_action:
      "Continue AI intake and collect non-emergency theft details.",
  };
  applyDanaPorter(transcript, incident_patch);
  return {
    tool_requests: [],
    incident_patch,
    call_session_patch: {
      status: "active",
      ai_active: true,
      next_question,
      should_escalate: false,
    },
    system_actions: [],
    say_to_caller: next_question,
  };
}

function activeBreakInDraft(transcript: string, mode: AgentMode): RawDraft {
  const next_question = "What is your exact location?";
  const incident_patch: Record<string, unknown> = {
    mode,
    urgency: "critical",
    incident_type: "active_break_in",
    operator_required: true,
    status: "collecting_location",
    control_state: "ai_location_collection",
    ai_active: true,
    summary: "Caller reports an active break-in.",
    collected_fields: { reported_emergency: "active break-in" },
    missing_fields: [
      "location",
      "caller_safety",
      "injuries",
      "suspect_location",
      "callback_number",
    ],
    recommended_action:
      "Ask for exact location once, then escalate to human operator.",
  };
  applyDanaPorter(transcript, incident_patch);
  return {
    tool_requests: [],
    incident_patch,
    call_session_patch: {
      status: "active",
      ai_active: true,
      next_question,
      should_escalate: true,
    },
    system_actions: [],
    say_to_caller: next_question,
  };
}

function medicalDraft(transcript: string, mode: AgentMode): RawDraft {
  const next_question = "What is your exact location?";
  const incident_patch: Record<string, unknown> = {
    mode,
    urgency: "critical",
    incident_type: "medical_emergency",
    operator_required: true,
    status: "collecting_location",
    control_state: "ai_location_collection",
    ai_active: true,
    summary:
      "Caller reports a medical emergency such as collapse or unconscious person.",
    collected_fields: { reported_emergency: "medical_collapse" },
    missing_fields: [
      "location",
      "patient_breathing",
      "patient_age",
      "callback_number",
    ],
    recommended_action: "Ask location and escalate to operator.",
  };
  applyDanaPorter(transcript, incident_patch);
  return {
    tool_requests: [],
    incident_patch,
    call_session_patch: {
      status: "active",
      ai_active: true,
      next_question,
      should_escalate: true,
    },
    system_actions: [],
    say_to_caller: next_question,
  };
}

function criticalLocationDraft(
  incidentType: "gas_leak" | "fire" | "trapped_person",
  summary: string,
  transcript: string,
  mode: AgentMode
): RawDraft {
  const next_question = "What is your exact location?";
  const incident_patch: Record<string, unknown> = {
    mode,
    urgency: "critical",
    incident_type: incidentType,
    operator_required: true,
    status: "collecting_location",
    control_state: "ai_location_collection",
    ai_active: true,
    summary,
    collected_fields: { reported_emergency: incidentType },
    missing_fields: [
      "location",
      "caller_safety",
      "people_involved",
      "callback_number",
    ],
    recommended_action: "Ask location and escalate to operator.",
  };
  applyDanaPorter(transcript, incident_patch);
  return {
    tool_requests: [],
    incident_patch,
    call_session_patch: {
      status: "active",
      ai_active: true,
      next_question,
      should_escalate: true,
    },
    system_actions: [],
    say_to_caller: next_question,
  };
}

function lostItemDraft(transcript: string, mode: AgentMode): RawDraft {
  const next_question =
    "What item did you lose, and where did you last see it?";
  const incident_patch: Record<string, unknown> = {
    mode,
    urgency: "non_emergency",
    incident_type: "lost_item",
    operator_required: false,
    status: "active_call",
    control_state: "ai_leading",
    ai_active: true,
    summary: "Caller reports a lost item.",
    collected_fields: {},
    missing_fields: [
      "item_description",
      "last_known_location",
      "time_lost",
      "callback_number",
    ],
    recommended_action:
      "Continue AI intake and collect lost-item report details.",
  };
  applyDanaPorter(transcript, incident_patch);
  return {
    tool_requests: [],
    incident_patch,
    call_session_patch: {
      status: "active",
      ai_active: true,
      next_question,
      should_escalate: false,
    },
    system_actions: [],
    say_to_caller: next_question,
  };
}

function missingPersonDraft(transcript: string, mode: AgentMode): RawDraft {
  const next_question = "What is your exact location?";
  const incident_patch: Record<string, unknown> = {
    mode,
    urgency: "critical",
    incident_type: "missing_person",
    operator_required: true,
    status: "collecting_location",
    control_state: "ai_location_collection",
    ai_active: true,
    summary: "Caller reports a missing person or lost child.",
    collected_fields: { reported_emergency: "missing_person" },
    missing_fields: [
      "location",
      "person_description",
      "last_seen_time",
      "callback_number",
    ],
    recommended_action: "Ask location and escalate to operator.",
  };
  applyDanaPorter(transcript, incident_patch);
  return {
    tool_requests: [],
    incident_patch,
    call_session_patch: {
      status: "active",
      ai_active: true,
      next_question,
      should_escalate: true,
    },
    system_actions: [],
    say_to_caller: next_question,
  };
}

function crowdSurgeDraft(transcript: string, mode: AgentMode): RawDraft {
  const next_question = "What is your exact location?";
  const incident_patch: Record<string, unknown> = {
    mode,
    urgency: "urgent",
    incident_type: "crowd_surge",
    operator_required: true,
    status: "collecting_location",
    control_state: "ai_location_collection",
    ai_active: true,
    summary:
      "Caller reports crowd pushing or a possible stadium crowd surge.",
    collected_fields: { reported_emergency: "crowd_surge" },
    missing_fields: [
      "location",
      "injuries",
      "crowd_density",
      "callback_number",
    ],
    recommended_action:
      "Collect exact location and escalate to operator for crowd response.",
  };
  applyDanaPorter(transcript, incident_patch);
  return {
    tool_requests: [],
    incident_patch,
    call_session_patch: {
      status: "active",
      ai_active: true,
      next_question,
      should_escalate: true,
    },
    system_actions: [],
    say_to_caller: next_question,
  };
}

function unknownDraft(transcript: string, mode: AgentMode): RawDraft {
  const next_question = "Can you briefly tell me what happened?";
  const incident_patch: Record<string, unknown> = {
    mode,
    urgency: "unknown",
    incident_type: "unknown",
    operator_required: false,
    status: "active_call",
    control_state: "ai_leading",
    ai_active: true,
    summary:
      "Caller's message is unclear; need a short clarification before triage.",
    collected_fields: {},
    missing_fields: [
      "incident_summary",
      "location",
      "callback_number",
    ],
    recommended_action: "Ask one short clarifying question and re-evaluate.",
  };
  applyDanaPorter(transcript, incident_patch);
  return {
    tool_requests: [],
    incident_patch,
    call_session_patch: {
      status: "active",
      ai_active: true,
      next_question,
      should_escalate: false,
    },
    system_actions: [],
    say_to_caller: next_question,
  };
}

function buildDraft(
  transcript: string,
  mode: AgentMode,
  toolResults: readonly ToolResult[] | undefined
): RawDraft {
  // Demo trigger: must come first so the geocoding-demo path can drive the
  // two-pass tool loop deterministically without any Gemma/Featherless wiring.
  if (matchesAny(transcript, KEYWORDS.geocodingDemo)) {
    if (toolResults && toolResults.length > 0) {
      return geocodingDemoSecondPassDraft(transcript, mode, toolResults);
    }
    return geocodingDemoFirstPassDraft(transcript, mode);
  }
  // Specific patterns first; "lost child" must beat generic "lost ...".
  if (matchesAny(transcript, KEYWORDS.missingPerson)) {
    return missingPersonDraft(transcript, mode);
  }
  if (matchesAny(transcript, KEYWORDS.activeBreakIn)) {
    return activeBreakInDraft(transcript, mode);
  }
  if (matchesAny(transcript, KEYWORDS.medical)) {
    return medicalDraft(transcript, mode);
  }
  if (matchesAny(transcript, KEYWORDS.trapped)) {
    return criticalLocationDraft(
      "trapped_person",
      "Caller reports a person trapped and unable to get out.",
      transcript,
      mode
    );
  }
  if (matchesAny(transcript, KEYWORDS.gasLeak)) {
    return criticalLocationDraft(
      "gas_leak",
      "Caller reports a gas smell or possible gas leak.",
      transcript,
      mode
    );
  }
  if (matchesAny(transcript, KEYWORDS.fire)) {
    return criticalLocationDraft(
      "fire",
      "Caller reports a fire.",
      transcript,
      mode
    );
  }
  if (matchesAny(transcript, KEYWORDS.crowdSurge)) {
    return crowdSurgeDraft(transcript, mode);
  }
  if (matchesAny(transcript, KEYWORDS.bikeTheft)) {
    return theftDraft(transcript, mode, true);
  }
  if (matchesAny(transcript, KEYWORDS.stolenItem)) {
    return theftDraft(transcript, mode, false);
  }
  if (matchesAny(transcript, KEYWORDS.lostItem)) {
    return lostItemDraft(transcript, mode);
  }
  return unknownDraft(transcript, mode);
}

/**
 * Mock Call Triage Agent entry point.
 *
 * Backend usage:
 *
 *   import { mockCallTriageAgent } from "@/lib/ai/agents/mockCallTriageAgent";
 *
 *   const result = await mockCallTriageAgent({
 *     incident,
 *     callSession,
 *     latestTranscript,
 *     transcriptHistory,
 *     mode: "normal",
 *   });
 *
 * The returned object is guaranteed (by Zod validation) to satisfy
 * `TriageAgentOutput`. The backend should still treat tool_requests and
 * system_actions as proposals only.
 */
export async function mockCallTriageAgent(
  input: CallTriageAgentInput
): Promise<TriageAgentOutput> {
  const latest = extractText(input.latestTranscript).toLowerCase().trim();
  // Combine full conversation history so keyword matching works even when
  // the emergency type was mentioned in a prior turn (e.g. "smoke" on turn 1,
  // location given on turn 2 — both turns should classify as fire).
  const history = (input.transcriptHistory ?? [])
    .map((t) => extractText(t).toLowerCase())
    .filter(Boolean);
  const fullTranscript = [...history, latest].join(" ");
  const mode: AgentMode = input.mode ?? "normal";
  const draft = buildDraft(fullTranscript, mode, input.toolResults);
  return validateTriageAgentOutput(draft);
}
