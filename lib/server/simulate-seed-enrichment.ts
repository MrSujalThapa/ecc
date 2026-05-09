/**
 * Rich demo fields for `/api/simulate/disaster` and `/api/simulate/world-cup` seeds
 * (Toronto-area pins, plausible summaries, session next_question).
 */

import type { Incident, CallSession } from "@/lib/types/domain";
import type { AppMode } from "@/lib/types/enums";
import type { Json } from "@/lib/types/json";
import { isoNow } from "@/lib/server/iso-now";

type Scenario = {
  incident_type: string;
  urgency: Incident["urgency"];
  status: Incident["status"];
  summary: string;
  location: string;
  location_status: Incident["location_status"];
  location_confidence: number | null;
  /** Offset from downtown Toronto (approx. km-scale spread by seed index). */
  latOffset: number;
  lngOffset: number;
  operator_required: boolean | null;
  recommended_action: string;
  missing_fields: string[];
  collected_fields: Record<string, Json>;
  cluster_id: string | null;
  priority_score: number | null;
  next_question: string;
  session_missing_fields: string[];
  should_escalate: boolean;
};

const TORONTO_BASE = { lat: 43.6532, lng: -79.3832 };

const DISASTER_SCENARIOS: readonly Scenario[] = [
  {
    incident_type: "structure_fire",
    urgency: "critical",
    status: "active_call",
    summary: "Caller reports smoke on upper floors; multiple units possibly occupied.",
    location: "Near Bloor & Spadina — high-rise residential",
    location_status: "approximate_by_ai",
    location_confidence: 0.62,
    latOffset: 0.015,
    lngOffset: -0.018,
    operator_required: true,
    recommended_action: "Dispatch fire + EMS; verify evacuation status.",
    missing_fields: ["exact_floor", "smoke_color", "injuries_confirmed"],
    collected_fields: { smoke_visible: true, structure_type: "high_rise" },
    cluster_id: "DISASTER-CORE-01",
    priority_score: 0.92,
    next_question: "What floor or unit is the smoke strongest on, if known?",
    session_missing_fields: ["exact_floor"],
    should_escalate: true,
  },
  {
    incident_type: "earthquake_damage",
    urgency: "urgent",
    status: "collecting_location",
    summary: "Aftershock reported; caller hears cracking sounds in commercial building.",
    location: "Financial District — glass tower lobby",
    location_status: "approximate_by_ai",
    location_confidence: 0.48,
    latOffset: -0.012,
    lngOffset: 0.022,
    operator_required: false,
    recommended_action: "Structural assessment queue; keep caller on line for safety.",
    missing_fields: ["injuries", "gas_odor", "building_evacuated"],
    collected_fields: { aftershock_felt: true },
    cluster_id: "DISASTER-CORE-01",
    priority_score: 0.78,
    next_question: "Is anyone injured or trapped that you can see or hear?",
    session_missing_fields: ["injuries"],
    should_escalate: false,
  },
  {
    incident_type: "medical_surge",
    urgency: "urgent",
    status: "active_call",
    summary: "Multiple walk-in medical issues at temporary shelter; staff overwhelmed.",
    location: "Exhibition Place — emergency shelter hall B",
    location_status: "confirmed_by_ai",
    location_confidence: 0.71,
    latOffset: 0.028,
    lngOffset: 0.01,
    operator_required: true,
    recommended_action: "Triage EMS staging; coordinate with shelter lead.",
    missing_fields: ["patient_count", "conscious_patients"],
    collected_fields: { shelter_zone: "hall_b" },
    cluster_id: "DISASTER-MED-02",
    priority_score: 0.85,
    next_question: "Roughly how many people need medical help right now?",
    session_missing_fields: ["patient_count"],
    should_escalate: true,
  },
  {
    incident_type: "power_grid",
    urgency: "non_emergency",
    status: "active_call",
    summary: "Widespread outage affecting traffic signals; no injuries reported yet.",
    location: "West end — Dundas & Keele intersection",
    location_status: "approximate_by_ai",
    location_confidence: 0.55,
    latOffset: -0.02,
    lngOffset: -0.025,
    operator_required: false,
    recommended_action: "Notify transit ops; log for utility coordination batch.",
    missing_fields: ["estimated_blocks_affected"],
    collected_fields: { traffic_signals_out: true },
    cluster_id: "DISASTER-INFRA-03",
    priority_score: 0.42,
    next_question: "About how many blocks lose power from where you are?",
    session_missing_fields: ["estimated_blocks_affected"],
    should_escalate: false,
  },
] as const;

const WORLD_CUP_SCENARIOS: readonly Scenario[] = [
  {
    incident_type: "crowd_safety",
    urgency: "urgent",
    status: "active_call",
    summary: "Dense crowd near stadium gate; caller worried about crush risk before kickoff.",
    location: "BMO Field — north plaza",
    location_status: "approximate_by_ai",
    location_confidence: 0.58,
    latOffset: 0.022,
    lngOffset: 0.016,
    operator_required: true,
    recommended_action: "Event security + crowd control; PA guidance if available.",
    missing_fields: ["gate_number", "security_on_scene"],
    collected_fields: { event_phase: "pre_kickoff" },
    cluster_id: "WC-STADIUM-N",
    priority_score: 0.8,
    next_question: "Which gate or section are you closest to?",
    session_missing_fields: ["gate_number"],
    should_escalate: true,
  },
  {
    incident_type: "lost_person",
    urgency: "non_emergency",
    status: "collecting_location",
    summary: "Visitor separated from group; limited English; last seen near fan zone.",
    location: "Exhibition grounds — fan festival east stage",
    location_status: "approximate_by_ai",
    location_confidence: 0.44,
    latOffset: 0.018,
    lngOffset: -0.012,
    operator_required: false,
    recommended_action: "Lost-person protocol; photo share to event comms.",
    missing_fields: ["clothing_description", "photo_available"],
    collected_fields: { caller_language: "es" },
    cluster_id: "WC-FANZONE-E",
    priority_score: 0.35,
    next_question: "Can you describe what the missing person was wearing?",
    session_missing_fields: ["clothing_description"],
    should_escalate: false,
  },
  {
    incident_type: "transit_medical",
    urgency: "urgent",
    status: "active_call",
    summary: "Overcrowded shuttle bus; passenger fainting; driver requesting guidance.",
    location: "Union Station — GO bus bay 5",
    location_status: "confirmed_by_ai",
    location_confidence: 0.66,
    latOffset: -0.008,
    lngOffset: 0.019,
    operator_required: true,
    recommended_action: "EMS to bay; transit supervisor loop.",
    missing_fields: ["conscious", "bus_number"],
    collected_fields: { shuttle_route: "stadium_express" },
    cluster_id: "WC-TRANSIT-U",
    priority_score: 0.74,
    next_question: "Is the person conscious and breathing normally right now?",
    session_missing_fields: ["conscious"],
    should_escalate: true,
  },
  {
    incident_type: "noise_security",
    urgency: "non_emergency",
    status: "active_call",
    summary: "Large group noise complaint near hotel strip; possible fireworks.",
    location: "King West — hotel row",
    location_status: "approximate_by_ai",
    location_confidence: 0.5,
    latOffset: -0.014,
    lngOffset: 0.008,
    operator_required: false,
    recommended_action: "Bylaw / event security awareness; low EMS unless injuries.",
    missing_fields: ["injuries_observed"],
    collected_fields: { fireworks_heard: true },
    cluster_id: "WC-NIGHTLIFE",
    priority_score: 0.38,
    next_question: "Do you see any injuries or open flames?",
    session_missing_fields: ["injuries_observed"],
    should_escalate: false,
  },
] as const;

const jitter = (seedIndex: number): { lat: number; lng: number } => {
  const ring = (seedIndex % 5) * 0.004;
  const angle = (seedIndex * 0.7) % (Math.PI * 2);
  return {
    lat: Math.cos(angle) * ring,
    lng: Math.sin(angle) * ring,
  };
};

/**
 * Applies rotating scenario templates for disaster / world_cup simulate batches.
 * Other modes return inputs unchanged.
 */
export const mergeSimulatedSurgeRow = (
  incident: Incident,
  session: CallSession,
  mode: AppMode,
  seedIndex: number
): { incident: Incident; call_session: CallSession } => {
  if (mode !== "disaster" && mode !== "world_cup") {
    return { incident, call_session: session };
  }

  const scenarios = mode === "disaster" ? DISASTER_SCENARIOS : WORLD_CUP_SCENARIOS;
  const pick = scenarios[seedIndex % scenarios.length]!;
  const j = jitter(seedIndex);
  const t = isoNow();

  const coordinates = {
    lat: Number((TORONTO_BASE.lat + pick.latOffset + j.lat).toFixed(5)),
    lng: Number((TORONTO_BASE.lng + pick.lngOffset + j.lng).toFixed(5)),
  };

  const nextIncident: Incident = {
    ...incident,
    mode,
    urgency: pick.urgency,
    incident_type: pick.incident_type,
    status: pick.status,
    summary: pick.summary,
    location: pick.location,
    location_status: pick.location_status,
    location_confidence: pick.location_confidence,
    coordinates,
    operator_required: pick.operator_required,
    recommended_action: pick.recommended_action,
    missing_fields: [...pick.missing_fields],
    collected_fields: { ...pick.collected_fields },
    custom_fields: incident.custom_fields,
    cluster_id: pick.cluster_id,
    priority_score: pick.priority_score,
    updated_at: t,
    last_updated_by: "simulate:seed",
  };

  const nextSession: CallSession = {
    ...session,
    next_question: pick.next_question,
    missing_fields: [...pick.session_missing_fields],
    should_escalate: pick.should_escalate,
    updated_at: t,
  };

  return { incident: nextIncident, call_session: nextSession };
};
