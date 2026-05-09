/**
 * Rich demo fields for `/api/simulate/disaster` and `/api/simulate/world-cup` seeds
 * (Toronto-area pins, plausible summaries, session next_question, mock `recent_transcript`).
 */

import type { Incident, CallSession } from "@/lib/types/domain";
import type { AppMode } from "@/lib/types/enums";
import type { Json } from "@/lib/types/json";
import {
  coordinatesForDisasterSimSeedIndex,
  DISASTER_SIM_SEED_GEO_SLOTS,
  SIMULATE_SEED_TORONTO_BASE,
  simulateSeedJitter,
} from "@/lib/mock/simulate-seed-geometry";
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
  /** First-person line appended as a simulated caller turn in `recent_transcript`. */
  seed_caller_text: string;
};

/** Synthetic operators for disaster simulate batches (queue filter / load demo). */
export const DISASTER_SIM_OPERATOR_POOL = 10 as const;

/**
 * How many incidents get a synthetic `DIS-SIM-OP-*` assignment.
 * One incident per operator max (pool size 10), capped by batch size — e.g. batch 50 → 10 assigned, 40 unassigned.
 */
export const disasterSimulatedAssignedCount = (batchSize: number): number => {
  if (batchSize <= 0) {
    return 0;
  }
  return Math.min(batchSize, DISASTER_SIM_OPERATOR_POOL);
};

/** `batchLocalIndex` must be `0 .. disasterSimulatedAssignedCount(batchSize) - 1` (unique id per slot, max index 9). */
const disasterSimulatedOperatorId = (batchLocalIndex: number): string =>
  `DIS-SIM-OP-${String(batchLocalIndex + 1).padStart(2, "0")}`;

export type MergeSimulatedSurgeOptions = {
  /** When set on `mode: "disaster"`, assigns distinct DIS-SIM-OP-* to the first rows (one incident per operator). */
  disasterBatch?: { batchLocalIndex: number; batchSize: number };
};

const DISASTER_SCENARIOS: readonly Scenario[] = [
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[0],
    incident_type: "structure_fire",
    status: "active_call",
    summary: "Caller reports smoke on upper floors; multiple units possibly occupied.",
    location: "Near Bloor & Spadina — high-rise residential",
    location_status: "approximate_by_ai",
    location_confidence: 0.62,
    operator_required: true,
    recommended_action: "Dispatch fire + EMS; verify evacuation status.",
    missing_fields: ["exact_floor", "smoke_color", "injuries_confirmed"],
    collected_fields: { smoke_visible: true, structure_type: "high_rise" },
    cluster_id: "DISASTER-CORE-01",
    priority_score: 0.92,
    next_question: "What floor or unit is the smoke strongest on, if known?",
    session_missing_fields: ["exact_floor"],
    should_escalate: true,
    seed_caller_text:
      "I'm calling from a high-rise near Bloor and Spadina—there's smoke on the upper floors and I think people might still be inside.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[1],
    incident_type: "earthquake_damage",
    status: "collecting_location",
    summary: "Aftershock reported; caller hears cracking sounds in commercial building.",
    location: "Financial District — glass tower lobby",
    location_status: "approximate_by_ai",
    location_confidence: 0.48,
    operator_required: false,
    recommended_action: "Structural assessment queue; keep caller on line for safety.",
    missing_fields: ["injuries", "gas_odor", "building_evacuated"],
    collected_fields: { aftershock_felt: true },
    cluster_id: "DISASTER-CORE-01",
    priority_score: 0.78,
    next_question: "Is anyone injured or trapped that you can see or hear?",
    session_missing_fields: ["injuries"],
    should_escalate: false,
    seed_caller_text:
      "We just felt another aftershock—I'm in a glass tower downtown and I'm hearing cracking sounds in the building.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[2],
    incident_type: "medical_surge",
    status: "active_call",
    summary: "Multiple walk-in medical issues at temporary shelter; staff overwhelmed.",
    location: "Exhibition Place — emergency shelter hall B",
    location_status: "confirmed_by_ai",
    location_confidence: 0.71,
    operator_required: true,
    recommended_action: "Triage EMS staging; coordinate with shelter lead.",
    missing_fields: ["patient_count", "conscious_patients"],
    collected_fields: { shelter_zone: "hall_b" },
    cluster_id: "DISASTER-MED-02",
    priority_score: 0.85,
    next_question: "Roughly how many people need medical help right now?",
    session_missing_fields: ["patient_count"],
    should_escalate: true,
    seed_caller_text:
      "We're at the emergency shelter in Exhibition hall B—there's a surge of walk-ins with medical issues and we're overwhelmed.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[3],
    incident_type: "power_grid",
    status: "active_call",
    summary: "Widespread outage affecting traffic signals; no injuries reported yet.",
    location: "West end — Dundas & Keele intersection",
    location_status: "approximate_by_ai",
    location_confidence: 0.55,
    operator_required: false,
    recommended_action: "Notify transit ops; log for utility coordination batch.",
    missing_fields: ["estimated_blocks_affected"],
    collected_fields: { traffic_signals_out: true },
    cluster_id: "DISASTER-INFRA-03",
    priority_score: 0.42,
    next_question: "About how many blocks lose power from where you are?",
    session_missing_fields: ["estimated_blocks_affected"],
    should_escalate: false,
    seed_caller_text:
      "The power's out across a big stretch of the west end—traffic signals are dark at Dundas and Keele and it's getting messy.",
  },
  // ------- Extended disaster cohort (slots 4–28, project_plan.md §12.1) ------
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[4],
    incident_type: "trapped_person",
    status: "collecting_location",
    summary: "Caller reports neighbour trapped under collapsed wall after aftershock.",
    location: "Junction Triangle — low-rise residential",
    location_status: "approximate_by_ai",
    location_confidence: 0.6,
    operator_required: true,
    recommended_action: "Heavy rescue + EMS; keep caller on line for triangulation.",
    missing_fields: ["building_address", "responsive", "breathing"],
    collected_fields: { trapped_count: 1, hazard_type: "collapse" },
    cluster_id: "DISASTER-CORE-01",
    priority_score: 0.97,
    next_question: "Can you tell me the closest cross-street to the building?",
    session_missing_fields: ["building_address"],
    should_escalate: true,
    seed_caller_text:
      "A wall came down on my neighbour after the aftershock—I can hear him but he's pinned and I can't lift it.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[5],
    incident_type: "gas_leak",
    status: "collecting_location",
    summary: "Strong gas smell + hissing reported in evacuated condo lobby; building at risk.",
    location: "Liberty Village — King Street West condos",
    location_status: "approximate_by_ai",
    location_confidence: 0.58,
    operator_required: true,
    recommended_action: "Hazmat + fire; widen evacuation perimeter 100 m.",
    missing_fields: ["unit_count", "ignition_source"],
    collected_fields: { hissing_audible: true, evacuated: true },
    cluster_id: "DISASTER-HAZMAT-04",
    priority_score: 0.95,
    next_question: "Has anyone seen sparks, flames, or used elevators in the building?",
    session_missing_fields: ["ignition_source"],
    should_escalate: true,
    seed_caller_text:
      "We evacuated our building in Liberty Village—there's a really strong gas smell and I can hear hissing in the lobby.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[6],
    incident_type: "structural_collapse",
    status: "active_call",
    summary: "Partial roof collapse at heritage warehouse; bystander reports two people inside before tremor.",
    location: "Distillery District — heritage warehouse block",
    location_status: "confirmed_by_ai",
    location_confidence: 0.74,
    operator_required: true,
    recommended_action: "Urban search & rescue; structural engineer consult.",
    missing_fields: ["last_seen_count", "secondary_collapse_risk"],
    collected_fields: { occupants_pre_event: 2 },
    cluster_id: "DISASTER-CORE-01",
    priority_score: 0.94,
    next_question: "Are people still inside, and can you see or hear anyone?",
    session_missing_fields: ["last_seen_count"],
    should_escalate: true,
    seed_caller_text:
      "Part of a roof just caved in at the Distillery—I saw two people walk in right before the tremor and now there's debris everywhere.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[7],
    incident_type: "trapped_in_elevator",
    status: "active_call",
    summary: "Office tower elevator stopped between floors; 4 occupants, one with chest pain.",
    location: "Yonge & Eglinton — north office tower",
    location_status: "approximate_by_ai",
    location_confidence: 0.66,
    operator_required: true,
    recommended_action: "Elevator rescue + EMS standby for cardiac patient.",
    missing_fields: ["building_address", "elevator_id"],
    collected_fields: { occupants: 4, medical_concern: "chest_pain" },
    cluster_id: "DISASTER-MED-02",
    priority_score: 0.83,
    next_question: "Which building and which elevator bank are you stuck in?",
    session_missing_fields: ["building_address", "elevator_id"],
    should_escalate: true,
    seed_caller_text:
      "We're stuck between floors in an elevator at Yonge and Eglinton—one guy is grabbing his chest and looks really pale.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[8],
    incident_type: "medical_collapse",
    status: "active_call",
    summary: "Pedestrian unconscious on sidewalk after debris hit head; bystanders performing first aid.",
    location: "Queen & University — debris zone",
    location_status: "confirmed_by_ai",
    location_confidence: 0.78,
    operator_required: true,
    recommended_action: "EMS priority dispatch; keep airway clear; do not move.",
    missing_fields: ["breathing", "responsive"],
    collected_fields: { mechanism: "falling_debris", first_aid_in_progress: true },
    cluster_id: "DISASTER-MED-02",
    priority_score: 0.93,
    next_question: "Is the person breathing on their own right now?",
    session_missing_fields: ["breathing"],
    should_escalate: true,
    seed_caller_text:
      "Someone just got hit by falling glass at Queen and University—he's on the ground, eyes closed, and we don't know what to do.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[9],
    incident_type: "building_collapse",
    status: "collecting_location",
    summary: "Older walk-up reportedly buckled in High Park West; multiple residents unaccounted for.",
    location: "High Park West — walk-up apartments",
    location_status: "approximate_by_ai",
    location_confidence: 0.5,
    operator_required: true,
    recommended_action: "Heavy rescue + secondary collapse perimeter; family liaison.",
    missing_fields: ["resident_count", "exact_address"],
    collected_fields: { aftershock_correlated: true },
    cluster_id: "DISASTER-CORE-01",
    priority_score: 0.96,
    next_question: "Do you know the building address or which side of High Park you're on?",
    session_missing_fields: ["exact_address"],
    should_escalate: true,
    seed_caller_text:
      "I think a whole walk-up just buckled out near High Park West—people are running into the street and I don't know who's still inside.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[10],
    incident_type: "injury_falling_debris",
    status: "active_call",
    summary: "Two pedestrians cut by falling facade tile; conscious, bleeding, awaiting EMS.",
    location: "Queen West — storefront row",
    location_status: "confirmed_by_ai",
    location_confidence: 0.7,
    operator_required: true,
    recommended_action: "EMS to scene; secondary debris hazard above.",
    missing_fields: ["bleeding_severity", "wound_locations"],
    collected_fields: { pedestrians_injured: 2, conscious: true },
    cluster_id: "DISASTER-MED-02",
    priority_score: 0.74,
    next_question: "Can you describe how badly they're bleeding right now?",
    session_missing_fields: ["bleeding_severity"],
    should_escalate: true,
    seed_caller_text:
      "Two people just got hit by a chunk of facade on Queen West—they're awake but there's a lot of blood on their arms.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[11],
    incident_type: "gas_smell_residential",
    status: "active_call",
    summary: "Household reports faint gas smell after tremor; residents still inside, no hissing.",
    location: "Cabbagetown — Victorian row house",
    location_status: "approximate_by_ai",
    location_confidence: 0.6,
    operator_required: true,
    recommended_action: "Advise evacuation + window open; gas utility dispatch.",
    missing_fields: ["smell_strength", "ignition_source"],
    collected_fields: { hissing_audible: false, evacuated: false },
    cluster_id: "DISASTER-HAZMAT-04",
    priority_score: 0.78,
    next_question: "Have you turned off the stove and opened the windows yet?",
    session_missing_fields: ["smell_strength"],
    should_escalate: true,
    seed_caller_text:
      "After the shaking my whole house smells like gas in Cabbagetown—it's faint but it won't go away.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[12],
    incident_type: "broken_water_main",
    status: "active_call",
    summary: "Water main rupture flooding intersection; pedestrians displaced; no injuries.",
    location: "Yonge & Bloor — major intersection",
    location_status: "confirmed_by_ai",
    location_confidence: 0.82,
    operator_required: true,
    recommended_action: "Public works + traffic; coordinate with TTC subway impact.",
    missing_fields: ["flow_rate_estimate"],
    collected_fields: { intersection_flooded: true, transit_impact: "subway_entrance" },
    cluster_id: "DISASTER-INFRA-03",
    priority_score: 0.7,
    next_question: "Is water reaching the subway entrance or any storefronts?",
    session_missing_fields: ["flow_rate_estimate"],
    should_escalate: true,
    seed_caller_text:
      "A water main just blew at Yonge and Bloor—water is gushing across the intersection and people are scrambling.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[13],
    incident_type: "blocked_road_with_emergency",
    status: "active_call",
    summary: "Stalled vehicles blocking ambulance route on Lakeshore; collapsed signage.",
    location: "Lakeshore Blvd & Strachan",
    location_status: "approximate_by_ai",
    location_confidence: 0.65,
    operator_required: true,
    recommended_action: "Reroute EMS via Strachan; tow + signs crew.",
    missing_fields: ["vehicle_count_blocking"],
    collected_fields: { ambulance_delayed: true },
    cluster_id: "DISASTER-INFRA-03",
    priority_score: 0.81,
    next_question: "How many vehicles are blocking the road right now?",
    session_missing_fields: ["vehicle_count_blocking"],
    should_escalate: true,
    seed_caller_text:
      "An ambulance is stuck on Lakeshore at Strachan—a sign came down and there's a row of cars in the way.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[14],
    incident_type: "fire_alarm_active",
    status: "active_call",
    summary: "Fire alarm ringing at Eaton Centre; sprinklers activated on lower level; no flames seen.",
    location: "Eaton Centre — lower level food court",
    location_status: "confirmed_by_ai",
    location_confidence: 0.73,
    operator_required: true,
    recommended_action: "Fire investigation + crowd flow management.",
    missing_fields: ["smoke_visible", "evacuation_status"],
    collected_fields: { sprinklers_on: true, flames_visible: false },
    cluster_id: "DISASTER-CORE-01",
    priority_score: 0.69,
    next_question: "Can you see smoke anywhere or is it just water from sprinklers?",
    session_missing_fields: ["smoke_visible"],
    should_escalate: true,
    seed_caller_text:
      "The fire alarm at Eaton Centre is going off and the sprinklers in the food court are pouring water everywhere.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[15],
    incident_type: "evacuation_assistance_elderly",
    status: "active_call",
    summary: "Elderly resident on 6th floor with mobility issue; elevator out, needs evacuation help.",
    location: "Forest Hill — older mid-rise",
    location_status: "approximate_by_ai",
    location_confidence: 0.55,
    operator_required: true,
    recommended_action: "Fire rescue evacuation chair; well-being check.",
    missing_fields: ["unit_number", "medical_conditions"],
    collected_fields: { mobility_aid: "walker", floor: 6 },
    cluster_id: "DISASTER-MED-02",
    priority_score: 0.68,
    next_question: "Can you tell me her unit number and any medical conditions?",
    session_missing_fields: ["unit_number"],
    should_escalate: true,
    seed_caller_text:
      "My mother is on the 6th floor in Forest Hill and the elevator is out—she uses a walker and we can't get her down.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[16],
    incident_type: "minor_injuries_walk_in",
    status: "active_call",
    summary: "Community centre reports several walk-in cuts and bruises after panic exit.",
    location: "Riverdale — community centre",
    location_status: "confirmed_by_ai",
    location_confidence: 0.7,
    operator_required: true,
    recommended_action: "EMS triage; redirect non-critical to walk-in clinic.",
    missing_fields: ["patient_count"],
    collected_fields: { injury_type: "minor", panic_exit: true },
    cluster_id: "DISASTER-MED-02",
    priority_score: 0.6,
    next_question: "How many people need medical attention right now?",
    session_missing_fields: ["patient_count"],
    should_escalate: false,
    seed_caller_text:
      "We're at the Riverdale community centre—a bunch of people scraped themselves rushing out and we need someone to look at them.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[17],
    incident_type: "shelter_capacity",
    status: "active_call",
    summary: "Local shelter at 110% capacity; intake paused; coordination needed.",
    location: "Regent Park — community shelter",
    location_status: "confirmed_by_ai",
    location_confidence: 0.8,
    operator_required: true,
    recommended_action: "Open secondary shelter at Moss Park; transit support.",
    missing_fields: ["overflow_count"],
    collected_fields: { intake_paused: true },
    cluster_id: "DISASTER-MED-02",
    priority_score: 0.55,
    next_question: "Roughly how many people are still waiting outside?",
    session_missing_fields: ["overflow_count"],
    should_escalate: true,
    seed_caller_text:
      "The shelter in Regent Park is past capacity—we've got people waiting on the sidewalk and it's getting cold.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[18],
    incident_type: "structural_cracks_visible",
    status: "active_call",
    summary: "New diagonal cracks reported on commercial building exterior; engineer requested.",
    location: "Scarborough Town Centre — east plaza",
    location_status: "approximate_by_ai",
    location_confidence: 0.5,
    operator_required: false,
    recommended_action: "Structural engineer queue; cordon if cracks widen.",
    missing_fields: ["crack_growth_rate"],
    collected_fields: { crack_pattern: "diagonal" },
    cluster_id: "DISASTER-INFRA-03",
    priority_score: 0.5,
    next_question: "Are the cracks getting bigger as you watch?",
    session_missing_fields: ["crack_growth_rate"],
    should_escalate: false,
    seed_caller_text:
      "There's diagonal cracks running up the side of our building at Scarborough Town Centre that weren't there yesterday.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[19],
    incident_type: "internet_outage",
    status: "active_call",
    summary: "Wide internet outage in Etobicoke; senior unable to reach family.",
    location: "Etobicoke — residential block",
    location_status: "approximate_by_ai",
    location_confidence: 0.45,
    operator_required: false,
    recommended_action: "Log for ISP coordination; check-in callback.",
    missing_fields: ["estimated_block_count"],
    collected_fields: { provider_known: false },
    cluster_id: "DISASTER-INFRA-03",
    priority_score: 0.32,
    next_question: "Do other neighbours have the same outage?",
    session_missing_fields: ["estimated_block_count"],
    should_escalate: false,
    seed_caller_text:
      "Internet's been down across our street in Etobicoke since the shake—I can't get hold of my daughter.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[20],
    incident_type: "broken_window_minor",
    status: "active_call",
    summary: "Storefront window cracked but in place; debris on sidewalk; no injuries.",
    location: "The Annex — Bloor storefront",
    location_status: "approximate_by_ai",
    location_confidence: 0.62,
    operator_required: false,
    recommended_action: "Bylaw / property report; tape cordon if requested.",
    missing_fields: [],
    collected_fields: { glass_intact: true },
    cluster_id: null,
    priority_score: 0.28,
    next_question: "Is the glass still in the frame or has any of it fallen?",
    session_missing_fields: [],
    should_escalate: false,
    seed_caller_text:
      "Our shop window in the Annex got cracked from the shake—it's still up but there's bits on the sidewalk.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[21],
    incident_type: "fallen_tree",
    status: "active_call",
    summary: "Large tree down across residential street; no vehicles or people involved.",
    location: "High Park West — residential street",
    location_status: "approximate_by_ai",
    location_confidence: 0.6,
    operator_required: false,
    recommended_action: "Forestry crew; reroute traffic via parallel street.",
    missing_fields: ["street_name"],
    collected_fields: { traffic_blocked: true },
    cluster_id: null,
    priority_score: 0.3,
    next_question: "What street are you reporting from?",
    session_missing_fields: ["street_name"],
    should_escalate: false,
    seed_caller_text:
      "A big tree came down across our street near High Park—nobody's hurt but cars can't get through.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[22],
    incident_type: "broken_traffic_signals",
    status: "active_call",
    summary: "All-way intersection lights out; drivers improvising; no collisions yet.",
    location: "The Junction — Dundas & Annette",
    location_status: "confirmed_by_ai",
    location_confidence: 0.74,
    operator_required: false,
    recommended_action: "Traffic services; mobile stop signs en route.",
    missing_fields: [],
    collected_fields: { collisions_reported: false },
    cluster_id: "DISASTER-INFRA-03",
    priority_score: 0.34,
    next_question: "Have you seen any near-misses or collisions yet?",
    session_missing_fields: [],
    should_escalate: false,
    seed_caller_text:
      "All four signals at Dundas and Annette are dark—people are nudging through and someone's going to get hit.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[23],
    incident_type: "minor_road_damage",
    status: "active_call",
    summary: "Pavement crack on local road; safe to pass; logged for repair.",
    location: "East York — local residential",
    location_status: "approximate_by_ai",
    location_confidence: 0.55,
    operator_required: false,
    recommended_action: "Public works ticket; non-urgent.",
    missing_fields: [],
    collected_fields: { crack_width_estimate_cm: 3 },
    cluster_id: null,
    priority_score: 0.22,
    next_question: "How wide is the crack roughly, in finger widths?",
    session_missing_fields: [],
    should_escalate: false,
    seed_caller_text:
      "There's a new crack on our road in East York—about three fingers wide, just want it logged.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[24],
    incident_type: "abandoned_vehicle",
    status: "active_call",
    summary: "Driver abandoned car mid-intersection during tremor; vehicle blocking lane.",
    location: "Kensington Market — Augusta & Baldwin",
    location_status: "approximate_by_ai",
    location_confidence: 0.6,
    operator_required: false,
    recommended_action: "Tow request; bylaw notice.",
    missing_fields: ["plate_number"],
    collected_fields: { driver_present: false },
    cluster_id: null,
    priority_score: 0.26,
    next_question: "Can you see a license plate from where you are?",
    session_missing_fields: ["plate_number"],
    should_escalate: false,
    seed_caller_text:
      "Somebody just left their car in the middle of Augusta in Kensington—doors open, no driver, blocking the whole lane.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[25],
    incident_type: "business_property_damage",
    status: "active_call",
    summary: "Cafe owner reports interior damage and inventory loss; insurance follow-up.",
    location: "Leslieville — Queen East cafe row",
    location_status: "confirmed_by_ai",
    location_confidence: 0.68,
    operator_required: false,
    recommended_action: "Take incident report; insurance referral packet.",
    missing_fields: ["damage_estimate_cad"],
    collected_fields: { injuries_reported: false },
    cluster_id: null,
    priority_score: 0.24,
    next_question: "Roughly what's your estimate of the damage in dollars?",
    session_missing_fields: ["damage_estimate_cad"],
    should_escalate: false,
    seed_caller_text:
      "My cafe in Leslieville got tossed pretty good—broken plates, cracked counter, want to file a report for insurance.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[26],
    incident_type: "transit_delay_report",
    status: "active_call",
    summary: "Caller stranded on suspended subway line; requesting shuttle info.",
    location: "Spadina–University line — between stops",
    location_status: "approximate_by_ai",
    location_confidence: 0.5,
    operator_required: false,
    recommended_action: "Refer to TTC info line; bus shuttle schedule.",
    missing_fields: [],
    collected_fields: { medical_concern: false, claustrophobic: false },
    cluster_id: null,
    priority_score: 0.2,
    next_question: "Do you need any medical help, or just info on shuttle service?",
    session_missing_fields: [],
    should_escalate: false,
    seed_caller_text:
      "I've been stuck on the Spadina line for a while—nobody's hurt, just need to know how to get home.",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[27],
    incident_type: "caller_unclear",
    status: "active_call",
    summary: "Caller distressed and intermittent; line dropped before location captured.",
    location: "Downtown Toronto — unspecified",
    location_status: "unknown",
    location_confidence: 0.2,
    operator_required: true,
    recommended_action: "Attempt callback; flag for operator follow-up.",
    missing_fields: ["caller_location", "incident_type", "callback_number"],
    collected_fields: { line_dropped: true },
    cluster_id: null,
    priority_score: 0.45,
    next_question: "Can you tell me where you are right now?",
    session_missing_fields: ["caller_location"],
    should_escalate: true,
    seed_caller_text:
      "Please—I—it's bad, I think the building is—",
  },
  {
    ...DISASTER_SIM_SEED_GEO_SLOTS[28],
    incident_type: "aftershock_check_in",
    status: "active_call",
    summary: "Resident calling for reassurance after aftershock; no damage; situational awareness.",
    location: "Cabbagetown — residential",
    location_status: "approximate_by_ai",
    location_confidence: 0.6,
    operator_required: false,
    recommended_action: "Provide calm advice; share city info channel.",
    missing_fields: [],
    collected_fields: { damage_observed: false },
    cluster_id: null,
    priority_score: 0.18,
    next_question: "Is anyone with you injured or feeling unwell?",
    session_missing_fields: [],
    should_escalate: false,
    seed_caller_text:
      "Just felt another aftershock in Cabbagetown—nothing's broken but I wanted to check what we should do.",
  },
] as const satisfies readonly Scenario[];

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
    seed_caller_text:
      "I'm at BMO Field by the north plaza—there's a huge crowd packed in before kickoff and I'm worried about a crush.",
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
    seed_caller_text:
      "I got separated from someone in our group at the fan festival by the east stage—she doesn't speak much English.",
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
    seed_caller_text:
      "We're on the stadium shuttle and a passenger just fainted—the driver pulled into the GO bus bays at Union Station.",
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
    seed_caller_text:
      "There's a really loud crowd on King West by the hotels—someone set off what sounded like fireworks and it's chaotic.",
  },
  // ---- Extended World Cup cohort: multilingual + event-zone variety ----
  // (project_plan.md §13.2: include multilingual examples; lost person, medical,
  // crowd congestion, theft, transit disruption, and security concern.)
  {
    incident_type: "lost_child",
    urgency: "urgent",
    status: "collecting_location",
    summary: "Spanish-speaking parent reports lost 6-year-old near south plaza; last seen 5 min ago.",
    location: "BMO Field — south plaza near medical tent",
    location_status: "approximate_by_ai",
    location_confidence: 0.55,
    latOffset: 0.018,
    lngOffset: 0.014,
    operator_required: true,
    recommended_action: "Lost-child protocol; alert event staff; loop in Spanish translator.",
    missing_fields: ["child_clothing", "callback_number"],
    collected_fields: {
      caller_language: "es",
      original_text:
        "Mi hijo de seis años se perdió cerca de la plaza sur, justo al lado del puesto médico. Hace cinco minutos que no lo veo.",
      child_age: 6,
    },
    cluster_id: "WC-FANZONE-W",
    priority_score: 0.86,
    next_question: "What was your child wearing—color of shirt and pants?",
    session_missing_fields: ["child_clothing"],
    should_escalate: true,
    seed_caller_text:
      "I lost my six-year-old near the south plaza by the medical tent—he was here five minutes ago and I can't find him.",
  },
  {
    incident_type: "medical_heat_exhaustion",
    urgency: "urgent",
    status: "active_call",
    summary: "Tourist showing heat exhaustion in fan zone; conscious but disoriented; bystander helping.",
    location: "Fan zone east — near east stage",
    location_status: "confirmed_by_ai",
    location_confidence: 0.7,
    latOffset: 0.02,
    lngOffset: -0.01,
    operator_required: true,
    recommended_action: "Direct to nearest medical tent; EMS standby if not improving.",
    missing_fields: ["water_available", "current_temperature"],
    collected_fields: { conscious: true, fluids_given: false },
    cluster_id: "WC-FANZONE-E",
    priority_score: 0.7,
    next_question: "Have they had any water in the last 10 minutes?",
    session_missing_fields: ["water_available"],
    should_escalate: true,
    seed_caller_text:
      "There's a woman in the fan zone east stage looking really pale and unsteady—I think it's the heat.",
  },
  {
    incident_type: "crowd_congestion",
    urgency: "urgent",
    status: "active_call",
    summary: "Portuguese-speaking caller reports dangerous crowd push at north gates pre-kickoff.",
    location: "BMO Field — north gates",
    location_status: "approximate_by_ai",
    location_confidence: 0.6,
    latOffset: 0.025,
    lngOffset: 0.02,
    operator_required: true,
    recommended_action: "Open secondary entry; PA crowd-flow guidance; security walk-through.",
    missing_fields: ["gate_letter"],
    collected_fields: {
      caller_language: "pt",
      original_text:
        "Tem muita gente empurrando aqui nos portões norte do BMO—está perigoso, alguém vai cair.",
      gate_area: "north",
    },
    cluster_id: "WC-STADIUM-N",
    priority_score: 0.84,
    next_question: "Which gate letter is closest to where you're standing?",
    session_missing_fields: ["gate_letter"],
    should_escalate: true,
    seed_caller_text:
      "There's so many people pushing at the BMO north gates—it's dangerous, somebody is going to get knocked down.",
  },
  {
    incident_type: "theft_phone",
    urgency: "non_emergency",
    status: "active_call",
    summary: "Phone snatched in fan zone crowd; suspect described, fled toward transit hub.",
    location: "Fan zone east — exit toward transit",
    location_status: "approximate_by_ai",
    location_confidence: 0.5,
    latOffset: 0.012,
    lngOffset: -0.015,
    operator_required: false,
    recommended_action: "Take theft report; alert nearby police post + transit security.",
    missing_fields: ["suspect_clothing", "phone_imei"],
    collected_fields: { item_stolen: "phone", suspect_direction: "transit_hub" },
    cluster_id: "WC-FANZONE-E",
    priority_score: 0.42,
    next_question: "Can you describe what the person who took it was wearing?",
    session_missing_fields: ["suspect_clothing"],
    should_escalate: false,
    seed_caller_text:
      "Someone just grabbed my phone out of my hand in the fan zone—they ran toward the transit station.",
  },
  {
    incident_type: "transit_disruption",
    urgency: "urgent",
    status: "active_call",
    summary: "French-speaking caller reports overcrowded shuttle bus stuck on closed ramp; passengers anxious.",
    location: "Lakeshore ramp — shuttle staging",
    location_status: "approximate_by_ai",
    location_confidence: 0.6,
    latOffset: -0.02,
    lngOffset: 0.012,
    operator_required: true,
    recommended_action: "Coordinate with transit ops; relief shuttle; calming PA in FR/EN.",
    missing_fields: ["passenger_count_estimate"],
    collected_fields: {
      caller_language: "fr",
      original_text:
        "Notre navette est bloquée sur la rampe Lakeshore—il y a trop de monde dedans et les gens commencent à paniquer.",
    },
    cluster_id: "WC-TRANSIT-LK",
    priority_score: 0.7,
    next_question: "About how many people are on the bus right now?",
    session_missing_fields: ["passenger_count_estimate"],
    should_escalate: true,
    seed_caller_text:
      "Our shuttle is stuck on the Lakeshore ramp—it's packed and people are starting to panic.",
  },
  {
    incident_type: "security_concern",
    urgency: "urgent",
    status: "active_call",
    summary: "Aggressive group near restricted vehicle zone refusing to move; security requesting backup.",
    location: "Princes' Blvd — restricted vehicle perimeter",
    location_status: "confirmed_by_ai",
    location_confidence: 0.78,
    latOffset: 0.005,
    lngOffset: 0.0,
    operator_required: true,
    recommended_action: "TPS dispatch; freeze vehicle access; de-escalation team.",
    missing_fields: ["weapons_visible"],
    collected_fields: { group_size_estimate: 12 },
    cluster_id: "WC-RESTRICTED",
    priority_score: 0.78,
    next_question: "Can you see any weapons or items being thrown?",
    session_missing_fields: ["weapons_visible"],
    should_escalate: true,
    seed_caller_text:
      "There's about a dozen people getting aggressive at the Princes' Boulevard checkpoint and they won't back off.",
  },
  {
    incident_type: "tourist_help_navigation",
    urgency: "non_emergency",
    status: "active_call",
    summary: "Spanish-speaking tourist disoriented near transit hub; no urgent need; needs nearest help point.",
    location: "Exhibition Place transit hub",
    location_status: "approximate_by_ai",
    location_confidence: 0.55,
    latOffset: 0.024,
    lngOffset: 0.005,
    operator_required: false,
    recommended_action: "Direct to nearest tourist help point; SMS map link if possible.",
    missing_fields: [],
    collected_fields: {
      caller_language: "es",
      original_text:
        "Estoy perdido cerca de la estación de tránsito del Exhibition—solo necesito que me indiquen dónde está la ayuda al turista.",
    },
    cluster_id: "WC-TRANSIT-EX",
    priority_score: 0.25,
    next_question: "Are you near a sign that mentions a stop name or gate letter?",
    session_missing_fields: [],
    should_escalate: false,
    seed_caller_text:
      "I'm lost near the Exhibition transit station—I just need someone to point me to the tourist help desk.",
  },
  {
    incident_type: "lost_and_found_pickup",
    urgency: "non_emergency",
    status: "active_call",
    summary: "Caller located missing wallet through fan zone info kiosk; routine confirmation.",
    location: "Fan zone — info kiosk",
    location_status: "confirmed_by_ai",
    location_confidence: 0.85,
    latOffset: 0.016,
    lngOffset: -0.005,
    operator_required: false,
    recommended_action: "Confirm with lost-and-found staff; close report after pickup.",
    missing_fields: [],
    collected_fields: { item: "wallet", pickup_pending: true },
    cluster_id: "WC-FANZONE-W",
    priority_score: 0.18,
    next_question: "Do you have ID with you to confirm pickup?",
    session_missing_fields: [],
    should_escalate: false,
    seed_caller_text:
      "I just want to confirm—my wallet got handed in to the info kiosk and I'm going to pick it up now.",
  },
  {
    incident_type: "counterfeit_ticket_dispute",
    urgency: "non_emergency",
    status: "active_call",
    summary: "Multiple fans turned away at gate with counterfeit tickets; tense but no violence.",
    location: "BMO Field — west gate",
    location_status: "confirmed_by_ai",
    location_confidence: 0.7,
    latOffset: 0.022,
    lngOffset: 0.012,
    operator_required: true,
    recommended_action: "Event security + fraud unit; redirect fans to ticket office.",
    missing_fields: ["fan_count"],
    collected_fields: { tickets_flagged: true, violence: false },
    cluster_id: "WC-STADIUM-W",
    priority_score: 0.34,
    next_question: "How many people are stuck at the gate right now?",
    session_missing_fields: ["fan_count"],
    should_escalate: false,
    seed_caller_text:
      "A bunch of us got told our tickets are fake at the BMO west gate—people are upset but nobody's fighting yet.",
  },
] as const;

/** Matches `appendTranscriptSupabase` / `appendTranscriptEvent` snippet shape. */
const buildSeedTranscriptSnippets = (pick: Scenario, baseIso: string): Json[] => {
  const tAi = new Date(Date.parse(baseIso) + 750).toISOString();
  return [
    {
      speaker: "caller",
      text: pick.seed_caller_text,
      is_final: true,
      created_at: baseIso,
    },
    {
      speaker: "ai",
      text: pick.next_question,
      is_final: true,
      created_at: tAi,
    },
  ];
};

/**
 * Applies rotating scenario templates for disaster / world_cup simulate batches.
 * Other modes return inputs unchanged.
 */
export const mergeSimulatedSurgeRow = (
  incident: Incident,
  session: CallSession,
  mode: AppMode,
  seedIndex: number,
  options?: MergeSimulatedSurgeOptions
): { incident: Incident; call_session: CallSession } => {
  if (mode !== "disaster" && mode !== "world_cup") {
    return { incident, call_session: session };
  }

  const scenarios = mode === "disaster" ? DISASTER_SCENARIOS : WORLD_CUP_SCENARIOS;
  const pick = scenarios[seedIndex % scenarios.length]!;
  const j = simulateSeedJitter(seedIndex);
  const t = isoNow();

  const coordinates =
    mode === "disaster"
      ? coordinatesForDisasterSimSeedIndex(seedIndex)
      : {
          lat: Number(
            (SIMULATE_SEED_TORONTO_BASE.lat + pick.latOffset + j.lat).toFixed(5),
          ),
          lng: Number(
            (SIMULATE_SEED_TORONTO_BASE.lng + pick.lngOffset + j.lng).toFixed(5),
          ),
        };

  const disasterBatch = mode === "disaster" ? options?.disasterBatch : undefined;
  let assigned_operator = incident.assigned_operator;
  if (disasterBatch) {
    const assignFirst = disasterSimulatedAssignedCount(disasterBatch.batchSize);
    assigned_operator =
      disasterBatch.batchLocalIndex < assignFirst
        ? disasterSimulatedOperatorId(disasterBatch.batchLocalIndex)
        : null;
  }

  /** DIS-SIM-OP-* rows: human control so top-bar “operator load” reflects assigned sim operators. */
  const disasterSimOperatorClaimed =
    mode === "disaster" && Boolean(disasterBatch) && assigned_operator !== null;

  const nextIncident: Incident = {
    ...incident,
    mode,
    urgency: pick.urgency,
    incident_type: pick.incident_type,
    status: disasterSimOperatorClaimed ? "human_active" : pick.status,
    control_state: disasterSimOperatorClaimed ? "human_active" : incident.control_state,
    ai_active: disasterSimOperatorClaimed ? false : incident.ai_active,
    summary: pick.summary,
    location: pick.location,
    location_status: pick.location_status,
    location_confidence: pick.location_confidence,
    coordinates,
    operator_required: pick.operator_required,
    assigned_operator,
    recommended_action: pick.recommended_action,
    missing_fields: [...pick.missing_fields],
    collected_fields: { ...pick.collected_fields },
    custom_fields: incident.custom_fields,
    cluster_id: pick.cluster_id,
    priority_score: pick.priority_score,
    updated_at: t,
    last_updated_by: "simulate:seed",
  };

  const seedSnippets = buildSeedTranscriptSnippets(pick, t);
  const recent_transcript: Json[] = [...session.recent_transcript, ...seedSnippets].slice(
    -50,
  );

  const nextSession: CallSession = {
    ...session,
    next_question: pick.next_question,
    missing_fields: [...pick.session_missing_fields],
    should_escalate: pick.should_escalate,
    updated_at: t,
    recent_transcript,
  };

  return { incident: nextIncident, call_session: nextSession };
};
