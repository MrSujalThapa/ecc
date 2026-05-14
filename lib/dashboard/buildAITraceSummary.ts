import type { CallSession, Incident } from "@/lib/types";

export type AITraceSummaryItem = {
  label: string;
  value: string;
  tone?: "default" | "info" | "warning";
};

export type AITraceSummary = {
  recommendation: AITraceSummaryItem[];
  escalation: AITraceSummaryItem[];
  confidence: AITraceSummaryItem[];
  trace: AITraceSummaryItem[];
};

const boolLabel = (
  value: boolean | null | undefined,
  labels: { yes: string; no: string; unknown?: string },
): string => {
  if (value === null || value === undefined) {
    return labels.unknown ?? "Unknown";
  }
  return value ? labels.yes : labels.no;
};

const percentLabel = (value: number | null | undefined): string => {
  if (typeof value !== "number") return "Unknown";
  return `${Math.round(value * 100)}%`;
};

const fieldCountLabel = (incident: Incident): string => {
  const count = Object.keys(incident.collected_fields).length;
  return count === 0 ? "None captured yet" : `${count} captured`;
};

const missingFieldsLabel = (incident: Incident): string => {
  if (incident.missing_fields.length === 0) {
    return "No missing fields";
  }
  return incident.missing_fields
    .map((field) => field.replaceAll("_", " "))
    .join(", ");
};

export const buildAITraceSummary = (
  incident: Incident,
  activeCallSession: CallSession | null = null,
): AITraceSummary => ({
  recommendation: [
    {
      label: "Recommended action",
      value: incident.recommended_action ?? "No recommendation yet",
      tone: incident.recommended_action ? "info" : "default",
    },
    {
      label: "Next AI question",
      value: activeCallSession?.next_question ?? "None queued",
    },
  ],
  escalation: [
    {
      label: "Operator required",
      value: boolLabel(incident.operator_required, {
        yes: "Yes",
        no: "No",
      }),
      tone: incident.operator_required ? "warning" : "default",
    },
    {
      label: "Transfer status",
      value: activeCallSession?.operator_transfer_status ?? "Not available",
    },
    {
      label: "Escalation flag",
      value: boolLabel(activeCallSession?.should_escalate, {
        yes: "Escalation recommended",
        no: "No escalation flagged",
        unknown: "Not available",
      }),
      tone: activeCallSession?.should_escalate ? "warning" : "default",
    },
  ],
  confidence: [
    {
      label: "Location status",
      value: incident.location_status.replaceAll("_", " "),
    },
    {
      label: "Location confidence",
      value: percentLabel(incident.location_confidence),
    },
    {
      label: "Model confidence",
      value: percentLabel(activeCallSession?.last_model_confidence),
    },
    {
      label: "Missing fields",
      value: missingFieldsLabel(incident),
      tone: incident.missing_fields.length > 0 ? "warning" : "default",
    },
    {
      label: "Collected fields",
      value: fieldCountLabel(incident),
    },
  ],
  trace: [
    {
      label: "Updated by",
      value: incident.last_updated_by,
    },
    {
      label: "Detailed runtime trace",
      value: "Not available in the dashboard drawer yet",
      tone: "default",
    },
  ],
});
