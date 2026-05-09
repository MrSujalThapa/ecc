"use client";

import type { Incident } from "@/lib/types";
import { useDashboardPersona } from "@/components/dashboard/DashboardPersonaContext";
import {
  formatIncidentType,
  formatStatusLabel,
  formatTimestamp,
  getIncidentDisplayId,
  urgencyLabel,
} from "@/lib/map/incidentStyling";

const modeBadgeClass: Record<string, string> = {
  normal: "border-[rgba(112,214,255,0.38)] bg-[#06111f] text-[#70d6ff]",
  disaster: "border-[rgba(112,214,255,0.18)] bg-[#bg-[#000814]] text-[#dbe7f3]",
  world_cup: "border-[rgba(112,214,255,0.18)] bg-[#0b1728] text-[#dbe7f3]",
};

const cardUrgencyBadgeClass: Record<Incident["urgency"], string> = {
  critical: "border-[#d00000]/45 bg-[#000814]/18 text-[#dbe7f3]",
  urgent: "border-[rgba(112,214,255,0.38)] bg-[#bg-[#000814]] text-[#dbe7f3]",
  non_emergency: "border-[rgba(112,214,255,0.18)] bg-[#0b1728] text-[#8b9bb0]",
  unknown: "border-[rgba(112,214,255,0.18)] bg-[#0b1728] text-[#8b9bb0]",
};

const controlBadgeClass: Record<string, string> = {
  ai_leading: "border-[rgba(112,214,255,0.38)] bg-[#bg-[#000814]] text-[#70d6ff]",
  ai_location_collection: "border-[rgba(112,214,255,0.18)] bg-[#0b1728] text-[#8b9bb0]",
  transferring: "border-[rgba(112,214,255,0.18)] bg-[#06111f] text-[#dbe7f3]",
  human_active: "border-[#52b788]/40 bg-[#52b788]/12 text-[#dbe7f3]",
  ai_completed: "border-[rgba(112,214,255,0.18)] bg-[#000814] text-[#8b9bb0]",
};

type IncidentCardProps = {
  incident: Incident;
  selected: boolean;
  onSelectIncident: (incidentId: string) => void;
};

export function IncidentCard({
  incident,
  selected,
  onSelectIncident,
}: IncidentCardProps) {
  const { visibility } = useDashboardPersona();
  const critical = incident.urgency === "critical";
  const modeClass =
    modeBadgeClass[incident.mode] ??
    "border-[rgba(112,214,255,0.18)] bg-[#0b1728] text-[#dbe7f3]";
  const controlClass =
    controlBadgeClass[incident.control_state] ??
    "border-[rgba(112,214,255,0.18)] bg-[#0b1728] text-[#8b9bb0]";

  const locationSummary = incident.coordinates
    ? `${incident.location ?? "Pinned location"} · ${formatStatusLabel(incident.location_status)}`
    : incident.location
      ? `${incident.location} · ${formatStatusLabel(incident.location_status)}`
      : `No location · ${formatStatusLabel(incident.location_status)}`;

  return (
    <button
      type="button"
      onClick={() => onSelectIncident(incident.id)}
      className={`group w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-[rgba(112,214,255,0.38)] bg-[#06111f] shadow-lg shadow-black/40 ring-1 ring-[rgba(112,214,255,0.22)]"
          : critical
            ? "border-[#d00000]/50 bg-[#000814]/12 shadow-lg shadow-black/30 hover:border-[#d00000]/65"
            : "border-[rgba(112,214,255,0.18)] bg-[#0b1728] hover:border-[rgba(112,214,255,0.28)] hover:bg-[#06111f]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-[#8b9bb0]">
            {getIncidentDisplayId(incident)}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${modeClass}`}>
            {incident.mode.replace("_", " ")}
          </span>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${cardUrgencyBadgeClass[incident.urgency]}`}
        >
          {urgencyLabel[incident.urgency]}
        </span>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-[#dbe7f3]">
        {formatIncidentType(incident.incident_type)}
      </h3>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#8b9bb0]">
        {incident.summary ?? "No summary available yet."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#8b9bb0]">
        <span className="rounded-full border border-[rgba(112,214,255,0.18)] bg-[#000814] px-2 py-1 capitalize text-[#dbe7f3]">
          {formatStatusLabel(incident.status)}
        </span>
        {visibility.showQueueControlState ? (
          <span className={`rounded-full border px-2 py-1 capitalize ${controlClass}`}>
            {formatStatusLabel(incident.control_state)}
          </span>
        ) : null}
        {visibility.showQueuePriorityScore ? (
          <span className="rounded-full border border-[rgba(112,214,255,0.18)] bg-[#000814] px-2 py-1 text-[#dbe7f3]">
            Score {incident.priority_score ?? "n/a"}
          </span>
        ) : null}
        {visibility.showQueueAiActiveBadge && incident.ai_active ? (
          <span className="rounded-full border border-[#52b788]/35 bg-[#52b788]/10 px-2 py-1 text-[#dbe7f3]">
            AI active
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#8b9bb0]">
        <span className="line-clamp-1">{locationSummary}</span>
        <span className="shrink-0">{formatTimestamp(incident.updated_at)}</span>
      </div>
    </button>
  );
}
