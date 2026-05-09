import type { AgentDecision } from "../schemas/callTriageAgentOutputV2Schema";
import type { ToolRequest } from "../schemas/toolRequestSchema";

export type AgenticTriageExample = {
  id: string;
  name: string;
  mode: "normal" | "disaster" | "world_cup";
  latestTranscript: string;
  languageHint?: string | null;
  expectedDecision: AgentDecision;
  expectedToolRequests: ToolRequest[];
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
      next_question: "I am connecting you to an operator now.",
    },
    expectedCallerResponse: "I am connecting you to an operator now.",
    notes:
      "After description details are collected, do not ask for location or what happened again. Escalate/transfer or ask only for a remaining high-value detail such as last seen time.",
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
        tool: "nearest_help_point_lookup",
        args: {
          location_text: "Gate 3",
          help_point_types: ["medical_tent", "police_tent", "security_tent"],
          mode: "world_cup",
        },
        reason:
          "Nearest medical/security help point context may help the operator response.",
        safety_level: "read_only",
      },
    ],
    notes:
      "Medical collapse is critical. Depending on confirmed location detail, V2 may ask exact location then escalate, or escalate immediately with event-zone and help-point context.",
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
        tool: "context_lookup",
        args: {
          context_type: "disaster_notes",
          query: "earthquake gas smell King Street blocked roads safety notes",
          mode: "disaster",
        },
        reason:
          "Disaster context, blocked-road notes, or safety notes may be useful for operator prioritization.",
        safety_level: "read_only",
      },
    ],
    notes:
      "Gas smell after earthquake should escalate. Tool requests are informational only; backend executes and validates any context lookup.",
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
        tool: "route_between_points",
        args: {
          from: "nearest_available_responder",
          to: "confirmed_incident_coordinates",
          avoid_context: ["blocked_roads"],
        },
        reason:
          "Planned second-pass request after backend confirms coordinates and responder context.",
        safety_level: "read_only",
      },
    ],
    notes:
      "Route request is a planned second-pass request only. In a real two-pass flow, route_between_points should wait for confirmed coordinates/tool context.",
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
        tool: "nearest_help_point_lookup",
        args: {
          location_text: "fan zone",
          help_point_types: [
            "lost_and_found",
            "police_tent",
            "security_tent",
            "tourist_help",
          ],
          mode: "world_cup",
        },
        reason:
          "Lost child requires escalation and nearby lost-and-found/security context.",
        safety_level: "read_only",
      },
    ],
    notes:
      "Lost child is high risk in event mode. Agent should escalate and request event/help-point context without directing final action itself.",
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
        tool: "context_lookup",
        args: {
          context_type: "event_safety_notes",
          query: "crowd pushing stadium gate safety operator guidance",
          mode: "world_cup",
        },
        reason:
          "Crowd safety and event-zone context can help operator review and prioritization.",
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
        tool: "nearest_help_point_lookup",
        args: {
          location_text: "train station",
          help_point_types: ["tourist_help", "transit_node", "police_tent"],
          mode: "world_cup",
        },
        reason:
          "Nearest tourist/transit help point can support a safe caller response.",
        safety_level: "read_only",
      },
    ],
    notes:
      "V2 output should set language fields such as detected_language='es' and caller_response_language='es' when feasible.",
  },
];
