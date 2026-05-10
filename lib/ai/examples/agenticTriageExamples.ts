import type { AgentDecision } from "../schemas/callTriageAgentOutputV2Schema";

/** Fixture shape may reference planned tools not yet in `safeToolNameSchema`. */
export type AgenticExpectedToolRequest = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  reason: string;
  safety_level: "read_only" | "operator_confirm_required";
};

export type AgenticTriageExample = {
  id: string;
  name: string;
  mode: "normal" | "disaster" | "world_cup";
  latestTranscript: string;
  languageHint?: string | null;
  expectedDecision: AgentDecision;
  expectedToolRequests: AgenticExpectedToolRequest[];
  notes: string;
  transcriptHistory?: string[];
  currentIncident?: Record<string, unknown>;
  currentCallSession?: Record<string, unknown>;
  expectedIncidentPatch?: Record<string, unknown>;
  expectedCallSessionPatch?: Record<string, unknown>;
  expectedCallerResponse?: string;
};

export const agenticTriageExamples: AgenticTriageExample[] = [
  {
    id: "agentic-bike-theft-dana-porter",
    name: "Stolen bike near Dana Porter Library",
    mode: "normal",
    latestTranscript: "Someone stole my bike near Dana Porter Library.",
    languageHint: null,
    expectedDecision: "continue_ai_handling",
    expectedToolRequests: [
      {
        id: "tr-bike-dp-geocode",
        tool: "geocode_location",
        args: {
          location_text: "Dana Porter Library",
          city_context: "Waterloo",
          country_context: "Canada",
        },
        reason: "Caller gave location text that should be geocoded.",
        safety_level: "read_only",
      },
    ],
    notes:
      "Normal-mode non-emergency theft report. V2 should continue AI intake after asking for item description, time of theft, suspect info, and callback details.",
  },
  {
    id: "agentic-lost-bike-safe-report",
    name: "Lost bike property report",
    mode: "normal",
    latestTranscript: "My bike is missing.",
    languageHint: null,
    expectedDecision: "continue_ai_handling",
    expectedToolRequests: [],
    expectedIncidentPatch: {
      urgency: "non_emergency",
      incident_type: "lost_item",
      operator_required: false,
      missing_fields: [
        "item_description",
        "last_seen_location",
        "time_last_seen",
        "suspect_info",
        "caller_safety",
        "callback_number",
      ],
    },
    expectedCallSessionPatch: {
      should_escalate: false,
      next_question:
        "What does the bike look like, and where was it last seen?",
    },
    expectedCallerResponse:
      "What does the bike look like, and where was it last seen?",
    notes:
      "Safe property/lost-item reports stay in AI intake. The agent should ask for item description and last seen location, with no transfer or dispatch promise.",
  },
  {
    id: "agentic-bike-theft-no-location",
    name: "Bike theft without location",
    mode: "normal",
    latestTranscript: "My bike was stolen.",
    languageHint: null,
    expectedDecision: "continue_ai_handling",
    expectedToolRequests: [],
    expectedIncidentPatch: {
      urgency: "non_emergency",
      incident_type: "bike_theft",
      operator_required: false,
      missing_fields: [
        "bike_description",
        "last_seen_location",
        "time_last_seen",
        "lock_status",
        "suspect_info",
        "callback_number",
      ],
    },
    expectedCallSessionPatch: {
      should_escalate: false,
      next_question:
        "Where was the bike last seen?",
    },
    expectedCallerResponse:
      "I'll collect the details for a report. Where was the bike last seen?",
    notes:
      'Bike theft with a safe caller should continue AI intake with no transfer or dispatch promise. Ask useful checklist questions before any generic closing. "non-emergency unit dispatched" is not allowed unless backend/operator/voice state confirms dispatch.',
  },
  {
    id: "agentic-bike-theft-turn-2-location",
    name: "Bike theft location provided",
    mode: "normal",
    latestTranscript: "It was last seen outside Dana Porter Library.",
    languageHint: null,
    transcriptHistory: [
      "AI: Tell me the emergency.",
      "Caller: My bike was stolen.",
      "AI: I'll collect the details for a report. Where was the bike last seen?",
    ],
    currentIncident: {
      urgency: "non_emergency",
      incident_type: "bike_theft",
      operator_required: false,
      missing_fields: [
        "bike_description",
        "last_seen_location",
        "time_last_seen",
        "lock_status",
        "suspect_info",
        "callback_number",
      ],
    },
    currentCallSession: {
      should_escalate: false,
      next_question: "Where was the bike last seen?",
    },
    expectedDecision: "continue_ai_handling",
    expectedToolRequests: [
      {
        id: "tr-bike-dp-location",
        tool: "geocode_location",
        args: {
          location_text: "Dana Porter Library",
          city_context: "Waterloo",
          country_context: "Canada",
        },
        reason: "Caller gave a last-seen location for the bike theft report.",
        safety_level: "read_only",
      },
    ],
    expectedIncidentPatch: {
      urgency: "non_emergency",
      incident_type: "bike_theft",
      operator_required: false,
      location: "Dana Porter Library",
      missing_fields: [
        "bike_description",
        "time_last_seen",
        "lock_status",
        "suspect_info",
        "callback_number",
      ],
    },
    expectedCallSessionPatch: {
      should_escalate: false,
      next_question:
        "Can you describe the bike, including color, brand, type, or unique features?",
    },
    expectedCallerResponse:
      "Can you describe the bike, including color, brand, type, or unique features?",
    notes:
      'After location is provided, ask bike description next. Do not ask "Do you need help with anything else?" yet, do not ask "Are you still at that location?" unless safety/location is uncertain, and do not close until required report details are collected.',
  },
  {
    id: "agentic-bike-theft-turn-3-description",
    name: "Bike theft description provided",
    mode: "normal",
    latestTranscript:
      "It's a black Trek mountain bike with a red bottle holder.",
    languageHint: null,
    transcriptHistory: [
      "AI: Tell me the emergency.",
      "Caller: My bike was stolen.",
      "AI: I'll collect the details for a report. Where was the bike last seen?",
      "Caller: It was last seen outside Dana Porter Library.",
      "AI: Can you describe the bike, including color, brand, type, or unique features?",
    ],
    currentIncident: {
      urgency: "non_emergency",
      incident_type: "bike_theft",
      operator_required: false,
      location: "Dana Porter Library",
      missing_fields: [
        "bike_description",
        "time_last_seen",
        "lock_status",
        "suspect_info",
        "callback_number",
      ],
    },
    currentCallSession: {
      should_escalate: false,
      next_question:
        "Can you describe the bike, including color, brand, type, or unique features?",
    },
    expectedDecision: "continue_ai_handling",
    expectedToolRequests: [],
    expectedIncidentPatch: {
      urgency: "non_emergency",
      incident_type: "bike_theft",
      operator_required: false,
      collected_fields: {
        bike_description:
          "Black Trek mountain bike with a red bottle holder.",
      },
      missing_fields: [
        "time_last_seen",
        "lock_status",
        "suspect_info",
        "callback_number",
      ],
    },
    expectedCallSessionPatch: {
      should_escalate: false,
      next_question:
        "What time was it last seen, and was it locked?",
    },
    expectedCallerResponse:
      "What time was it last seen, and was it locked?",
    notes:
      'After description is collected, ask time last seen or lock status next. Do not ask "Do you want me to stay on the line?", "Do you need help with anything else?", or close the report before time, lock status, suspect/witness info, and callback details are collected.',
  },
  {
    id: "agentic-active-break-in-no-location",
    name: "Active break-in with no exact location",
    mode: "normal",
    latestTranscript:
      "Someone is breaking into my house right now and I can hear them downstairs.",
    languageHint: null,
    expectedDecision: "ask_location_then_escalate",
    expectedToolRequests: [],
    notes:
      "Critical emergency without exact location. The agent should ask exact location once before tool lookup or escalation handoff.",
  },
  {
    id: "agentic-vehicle-theft-turn-1",
    name: "Vehicle theft reported, safety unknown",
    mode: "normal",
    latestTranscript: "My car got stolen.",
    languageHint: null,
    expectedDecision: "continue_ai_handling",
    expectedToolRequests: [],
    expectedIncidentPatch: {
      urgency: "non_emergency",
      incident_type: "vehicle_theft",
      operator_required: false,
      missing_fields: [
        "caller_safety",
        "last_seen_location",
        "vehicle_description",
        "license_plate",
        "time_stolen",
        "callback_number",
      ],
    },
    expectedCallSessionPatch: {
      should_escalate: false,
      next_question:
        "Are you safe, and where was the car last seen?",
    },
    expectedCallerResponse:
      "Are you safe, and where was the car last seen?",
    notes:
      "Vehicle theft should start report intake. Ask about safety or last seen location, and do not imply police or other help is already on the way.",
  },
  {
    id: "agentic-vehicle-theft-turn-2-safe",
    name: "Vehicle theft caller confirms safety",
    mode: "normal",
    latestTranscript: "Yes, I am safe.",
    languageHint: null,
    transcriptHistory: [
      "AI: Tell me the emergency.",
      "Caller: My car got stolen.",
      "AI: Are you safe, and where was the car last seen?",
    ],
    currentIncident: {
      urgency: "non_emergency",
      incident_type: "vehicle_theft",
      operator_required: false,
      missing_fields: [
        "caller_safety",
        "last_seen_location",
        "vehicle_description",
        "license_plate",
        "time_stolen",
        "callback_number",
      ],
    },
    currentCallSession: {
      should_escalate: false,
      next_question:
        "Are you safe, and where was the car last seen?",
    },
    expectedDecision: "continue_ai_handling",
    expectedToolRequests: [],
    expectedIncidentPatch: {
      urgency: "non_emergency",
      incident_type: "vehicle_theft",
      operator_required: false,
      collected_fields: { caller_safe: true },
      missing_fields: [
        "last_seen_location",
        "vehicle_description",
        "license_plate",
        "time_stolen",
        "callback_number",
      ],
    },
    expectedCallSessionPatch: {
      should_escalate: false,
      next_question:
        "What is the vehicle make, model, color, and license plate?",
    },
    expectedCallerResponse:
      "I'll collect the details now. What is the vehicle make, model, color, and license plate?",
    notes:
      "After the caller confirms they are safe, continue vehicle theft intake. Do not mark critical, transfer, or say help is on the way without backend/operator confirmation.",
  },
  {
    id: "agentic-child-kidnapping-turn-1",
    name: "Child kidnapping reported, location missing",
    mode: "normal",
    latestTranscript: "Someone kidnapped my child.",
    languageHint: null,
    expectedDecision: "ask_location_then_escalate",
    expectedToolRequests: [],
    expectedIncidentPatch: {
      urgency: "critical",
      incident_type: "kidnapping",
      operator_required: true,
      missing_fields: ["exact_location"],
    },
    expectedCallSessionPatch: {
      should_escalate: true,
      next_question: "What is your exact location?",
    },
    expectedCallerResponse: "What is your exact location?",
    notes:
      "Kidnapping or child-taken language is critical and operator-required. With no usable location, ask only for exact location and do not ask what happened again.",
  },
  {
    id: "agentic-child-kidnapping-turn-2-location",
    name: "Child kidnapping location provided",
    mode: "normal",
    latestTranscript: "110 University Ave, Waterloo.",
    languageHint: null,
    transcriptHistory: [
      "AI: Tell me the emergency.",
      "Caller: Someone kidnapped my child.",
      "AI: What is your exact location?",
    ],
    currentIncident: {
      urgency: "critical",
      incident_type: "kidnapping",
      operator_required: true,
      missing_fields: ["exact_location", "child_description"],
    },
    currentCallSession: {
      should_escalate: true,
      next_question: "What is your exact location?",
    },
    expectedDecision: "escalate_to_operator",
    expectedToolRequests: [
      {
        id: "tr-child-kidnapping-university-geocode",
        tool: "geocode_location",
        args: {
          location_text: "110 University Ave, Waterloo",
          city_context: "Waterloo",
          country_context: "Canada",
        },
        reason:
          "Caller provided a specific address that should be geocoded and preserved.",
        safety_level: "read_only",
      },
    ],
    expectedIncidentPatch: {
      urgency: "critical",
      incident_type: "kidnapping",
      operator_required: true,
      location: "110 University Ave, Waterloo",
      missing_fields: [
        "child_description",
        "suspect_description",
        "direction_of_travel",
        "vehicle_info",
        "last_seen_time",
      ],
    },
    expectedCallSessionPatch: {
      should_escalate: true,
      next_question:
        "Can you describe your child and anyone who took them?",
    },
    expectedCallerResponse:
      "Can you describe your child and anyone who took them?",
    notes:
      "The agent must preserve critical/kidnapping state, request geocoding for the specific address, and ask for child/suspect description instead of repeating location or what happened.",
  },
  {
    id: "agentic-child-kidnapping-turn-3-description",
    name: "Child kidnapping description provided",
    mode: "normal",
    latestTranscript:
      "She is six, wearing a yellow jacket. A man in a black hoodie took her toward a blue van.",
    languageHint: null,
    transcriptHistory: [
      "AI: Tell me the emergency.",
      "Caller: Someone kidnapped my child.",
      "AI: What is your exact location?",
      "Caller: 110 University Ave, Waterloo.",
      "AI: Can you describe your child and anyone who took them?",
    ],
    currentIncident: {
      urgency: "critical",
      incident_type: "kidnapping",
      operator_required: true,
      location: "110 University Ave, Waterloo",
      summary:
        "Caller reports their child was kidnapped at 110 University Ave, Waterloo.",
      missing_fields: [
        "child_description",
        "suspect_description",
        "direction_of_travel",
        "vehicle_info",
        "last_seen_time",
      ],
    },
    currentCallSession: {
      should_escalate: true,
      next_question:
        "Can you describe your child and anyone who took them?",
    },
    expectedDecision: "escalate_to_operator",
    expectedToolRequests: [],
    expectedIncidentPatch: {
      urgency: "critical",
      incident_type: "kidnapping",
      operator_required: true,
      location: "110 University Ave, Waterloo",
      description:
        "Child is six and wearing a yellow jacket. Suspect is a man in a black hoodie moving toward a blue van.",
      missing_fields: ["last_seen_time"],
    },
    expectedCallSessionPatch: {
      should_escalate: true,
      next_question:
        "Stay on the line while I check the next step. What time did this happen?",
    },
    expectedCallerResponse:
      "Stay on the line while I check the next step. What time did this happen?",
    notes:
      "After description details are collected, do not ask for location or what happened again. Request operator transfer through structured output, but keep collecting high-value details unless backend confirms transfer.",
  },
  {
    id: "agentic-medical-collapse-gate-3",
    name: "Medical collapse near Gate 3",
    mode: "world_cup",
    latestTranscript:
      "A man collapsed near Gate 3 and he is not responding. We need help.",
    languageHint: null,
    expectedDecision: "ask_location_then_escalate",
    expectedToolRequests: [
      {
        id: "tr-medical-gate3-zone",
        tool: "event_zone_lookup",
        args: {
          location_text: "Gate 3",
          mode: "world_cup",
        },
        reason: "Event location context may identify the exact gate or venue zone.",
        safety_level: "read_only",
      },
      {
        id: "tr-medical-gate3-help",
        tool: "responder_lookup",
        args: {
          incident_type: "medical_emergency",
          location_text: "Gate 3",
          mode: "world_cup",
        },
        reason:
          "Responder context may help the operator prioritize a medical emergency near Gate 3.",
        safety_level: "read_only",
      },
    ],
    notes:
      "Medical collapse is critical. Depending on confirmed location detail, V2 may ask exact location then escalate, or escalate immediately with event-zone and responder context. Nearest help-point lookup is future-only and not an active safe tool.",
  },
  {
    id: "agentic-gas-smell-earthquake-king-street",
    name: "Gas smell after earthquake near King Street",
    mode: "disaster",
    latestTranscript:
      "After the earthquake there is a strong gas smell near King Street and people are scared.",
    languageHint: null,
    expectedDecision: "escalate_to_operator",
    expectedToolRequests: [
      {
        id: "tr-gas-king-geocode",
        tool: "geocode_location",
        args: {
          location_text: "King Street",
          city_context: "Waterloo",
          country_context: "Canada",
        },
        reason: "Location text is needed for disaster triage and mapping.",
        safety_level: "read_only",
      },
      {
        id: "tr-gas-king-context",
        tool: "event_zone_lookup",
        args: {
          location_text: "King Street",
          mode: "disaster",
          context_focus: "earthquake gas smell blocked roads",
        },
        reason:
          "Disaster event-zone context may help operator prioritization near King Street.",
        safety_level: "read_only",
      },
    ],
    notes:
      "Gas smell after earthquake should escalate. Tool requests are informational only; context lookup is future-only and not an active safe tool.",
  },
  {
    id: "agentic-trapped-person-blocked-road",
    name: "Trapped person with blocked road mention",
    mode: "disaster",
    latestTranscript:
      "I am trapped near a collapsed parking structure and the road outside is blocked.",
    languageHint: null,
    expectedDecision: "escalate_to_operator",
    expectedToolRequests: [
      {
        id: "tr-trapped-geocode",
        tool: "geocode_location",
        args: {
          location_text: "collapsed parking structure",
          mode: "disaster",
        },
        reason: "The reported location needs backend geocoding before routing.",
        safety_level: "read_only",
      },
      {
        id: "tr-trapped-responder",
        tool: "responder_lookup",
        args: {
          incident_type: "trapped_person",
          mode: "disaster",
        },
        reason:
          "Responder availability context can help backend/operator prioritization.",
        safety_level: "read_only",
      },
      {
        id: "tr-trapped-route",
        tool: "responder_lookup",
        args: {
          incident_type: "trapped_person",
          mode: "disaster",
          route_planning_context: "blocked_roads",
        },
        reason:
          "Responder context can support future route planning after backend confirms coordinates.",
        safety_level: "read_only",
      },
    ],
    notes:
      "Responder lookup is active and safe. Route planning remains future-only; route_between_points should not be emitted until the schema supports it and backend has confirmed coordinates/tool context.",
  },
  {
    id: "agentic-lost-child-fan-zone",
    name: "Lost child near fan zone",
    mode: "world_cup",
    latestTranscript:
      "I lost my child near the fan zone and I cannot see him anywhere.",
    languageHint: null,
    expectedDecision: "escalate_to_operator",
    expectedToolRequests: [
      {
        id: "tr-lost-child-zone",
        tool: "event_zone_lookup",
        args: {
          location_text: "fan zone",
          mode: "world_cup",
        },
        reason: "Event-zone context can identify the relevant fan-zone area.",
        safety_level: "read_only",
      },
      {
        id: "tr-lost-child-help",
        tool: "responder_lookup",
        args: {
          incident_type: "missing_child",
          location_text: "fan zone",
          mode: "world_cup",
        },
        reason:
          "Lost child requires escalation and responder/security context.",
        safety_level: "read_only",
      },
    ],
    notes:
      "Lost child is high risk in event mode. Agent should escalate and request event-zone/responder context without directing final action itself. Nearest help-point lookup is future-only and not an active safe tool.",
  },
  {
    id: "agentic-crowd-pushing-stadium-gate",
    name: "Crowd pushing near stadium gate",
    mode: "world_cup",
    latestTranscript:
      "The crowd is pushing hard near the stadium gate and people are starting to fall.",
    languageHint: null,
    expectedDecision: "operator_review_recommended",
    expectedToolRequests: [
      {
        id: "tr-crowd-gate-zone",
        tool: "event_zone_lookup",
        args: {
          location_text: "stadium gate",
          mode: "world_cup",
        },
        reason: "Crowd-safety triage benefits from event-zone/gate context.",
        safety_level: "read_only",
      },
      {
        id: "tr-crowd-gate-context",
        tool: "event_zone_lookup",
        args: {
          location_text: "stadium gate",
          mode: "world_cup",
          context_focus: "crowd safety operator review",
        },
        reason:
          "Event-zone crowd context can help operator review and prioritization.",
        safety_level: "read_only",
      },
    ],
    notes:
      "Crowd surge may become critical. V2 should recommend operator review and avoid giving unsafe crowd-control instructions.",
  },
  {
    id: "agentic-spanish-transit-help",
    name: "Spanish caller needing help near transit hub",
    mode: "world_cup",
    latestTranscript:
      "Necesito ayuda cerca de la estación de tren. Estoy perdido y no encuentro el punto de información.",
    languageHint: "es",
    expectedDecision: "continue_ai_handling",
    expectedToolRequests: [
      {
        id: "tr-es-transit-zone",
        tool: "event_zone_lookup",
        args: {
          location_text: "train station",
          mode: "world_cup",
        },
        reason: "Transit hub context may identify the event-area location.",
        safety_level: "read_only",
      },
      {
        id: "tr-es-transit-help",
        tool: "event_zone_lookup",
        args: {
          location_text: "train station",
          mode: "world_cup",
          context_focus: "tourist help and transit support",
        },
        reason:
          "Event-zone transit context can support a safe caller response.",
        safety_level: "read_only",
      },
    ],
    notes:
      "V2 output should set language fields such as detected_language='es' and caller_response_language='es' when feasible. Nearest help-point lookup is future-only and not an active safe tool.",
  },
];
