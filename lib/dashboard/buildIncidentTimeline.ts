import type { CallSession, Incident } from "@/lib/types";

export type IncidentTimelineItem = {
  id: string;
  label: string;
  description?: string;
  timestamp?: string | null;
  kind:
    | "created"
    | "updated"
    | "triage"
    | "location"
    | "transfer"
    | "operator"
    | "status"
    | "note";
  source: "incident" | "call_session" | "derived";
};

type BuildIncidentTimelineInput = {
  incident: Incident;
  activeCallSession?: CallSession | null;
};

const TIMELINE_KIND_ORDER: Record<IncidentTimelineItem["kind"], number> = {
  created: 0,
  status: 1,
  location: 2,
  triage: 3,
  operator: 4,
  transfer: 5,
  updated: 6,
  note: 7,
};

const hasRealTimestamp = (value: string | null | undefined): boolean =>
  Boolean(value && !Number.isNaN(Date.parse(value)));

const countCollectedFields = (incident: Incident): number =>
  Object.keys(incident.collected_fields).length;

const buildBaseTimeline = (
  incident: Incident,
  activeCallSession: CallSession | null,
): IncidentTimelineItem[] => {
  const items: IncidentTimelineItem[] = [
    {
      id: `${incident.id}-created`,
      label: "Incident created",
      description: `Opened as ${incident.mode.replaceAll("_", " ")} incident intake.`,
      timestamp: incident.created_at,
      kind: "created",
      source: "incident",
    },
    {
      id: `${incident.id}-status`,
      label: "Current status",
      description: incident.status.replaceAll("_", " "),
      kind: "status",
      source: "incident",
    },
    {
      id: `${incident.id}-urgency`,
      label: "Urgency and priority",
      description:
        incident.priority_score === null
          ? `Urgency marked ${incident.urgency.replaceAll("_", " ")}.`
          : `Urgency marked ${incident.urgency.replaceAll("_", " ")} with priority score ${incident.priority_score}.`,
      kind: "status",
      source: "incident",
    },
  ];

  if (incident.location_status !== "unknown" || incident.location_confidence !== null) {
    items.push({
      id: `${incident.id}-location`,
      label: "Location state available",
      description:
        incident.location_confidence === null
          ? `Location status is ${incident.location_status.replaceAll("_", " ")}.`
          : `Location status is ${incident.location_status.replaceAll(
              "_",
              " ",
            )} at ${Math.round(incident.location_confidence * 100)}% confidence.`,
      kind: "location",
      source: "incident",
    });
  }

  if (incident.recommended_action) {
    items.push({
      id: `${incident.id}-recommendation`,
      label: "AI recommendation available",
      description: incident.recommended_action,
      kind: "triage",
      source: "incident",
    });
  }

  if (incident.missing_fields.length > 0) {
    items.push({
      id: `${incident.id}-missing-fields`,
      label: "Missing fields identified",
      description: incident.missing_fields
        .map((field) => field.replaceAll("_", " "))
        .join(", "),
      kind: "triage",
      source: "incident",
    });
  }

  const collectedFieldCount = countCollectedFields(incident);
  if (collectedFieldCount > 0) {
    items.push({
      id: `${incident.id}-collected-fields`,
      label: "Structured fields captured",
      description: `${collectedFieldCount} collected field${
        collectedFieldCount === 1 ? "" : "s"
      } available.`,
      kind: "triage",
      source: "incident",
    });
  }

  if (incident.operator_required !== null) {
    items.push({
      id: `${incident.id}-operator-required`,
      label: "Operator requirement evaluated",
      description: incident.operator_required
        ? "Operator involvement is currently recommended."
        : "Operator involvement is not currently required.",
      kind: "operator",
      source: "incident",
    });
  }

  if (activeCallSession) {
    if (activeCallSession.should_escalate) {
      items.push({
        id: `${incident.id}-escalation`,
        label: "Escalation flagged",
        description: "The active call session is marked for escalation.",
        kind: "operator",
        source: "call_session",
      });
    }

    if (activeCallSession.operator_transfer_status !== "not_requested") {
      items.push({
        id: `${incident.id}-transfer`,
        label: "Transfer status recorded",
        description: activeCallSession.operator_transfer_status.replaceAll(
          "_",
          " ",
        ),
        kind: "transfer",
        source: "call_session",
      });
    }

    if (activeCallSession.next_question) {
      items.push({
        id: `${incident.id}-next-question`,
        label: "Next AI question queued",
        description: activeCallSession.next_question,
        kind: "triage",
        source: "call_session",
      });
    }
  }

  if (
    incident.updated_at &&
    incident.updated_at !== incident.created_at &&
    hasRealTimestamp(incident.updated_at)
  ) {
    items.push({
      id: `${incident.id}-updated`,
      label: "Incident updated",
      description: `Last updated by ${incident.last_updated_by}.`,
      timestamp: incident.updated_at,
      kind: "updated",
      source: "incident",
    });
  }

  items.push({
    id: `${incident.id}-tool-trace-unavailable`,
    label: "Detailed tool trace unavailable",
    description: "Detailed tool timeline is not available in this drawer yet.",
    kind: "note",
    source: "derived",
  });

  return items;
};

export const buildIncidentTimeline = ({
  incident,
  activeCallSession = null,
}: BuildIncidentTimelineInput): IncidentTimelineItem[] =>
  buildBaseTimeline(incident, activeCallSession).sort((left, right) => {
    const leftHasTimestamp = hasRealTimestamp(left.timestamp);
    const rightHasTimestamp = hasRealTimestamp(right.timestamp);

    if (leftHasTimestamp && rightHasTimestamp) {
      const leftMs = Date.parse(left.timestamp!);
      const rightMs = Date.parse(right.timestamp!);
      if (leftMs !== rightMs) {
        return leftMs - rightMs;
      }
    } else if (leftHasTimestamp !== rightHasTimestamp) {
      return leftHasTimestamp ? -1 : 1;
    }

    const kindDelta =
      TIMELINE_KIND_ORDER[left.kind] - TIMELINE_KIND_ORDER[right.kind];
    if (kindDelta !== 0) {
      return kindDelta;
    }

    return left.id.localeCompare(right.id);
  });
