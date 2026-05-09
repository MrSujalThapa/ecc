import type { Incident } from "@/lib/types";
import {
  formatIncidentType,
  formatStatusLabel,
  getIncidentDisplayId,
  urgencyBadgeClass,
  urgencyLabel,
} from "@/lib/map/incidentStyling";

type ClusterIncidentListProps = {
  incidents: Incident[];
  onSelectIncident: (incidentId: string) => void;
};

export function ClusterIncidentList({
  incidents,
  onSelectIncident,
}: ClusterIncidentListProps) {
  if (incidents.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-[#040f16] p-3 text-sm text-slate-400">
        No matching incidents are currently visible for this cluster.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {incidents.map((incident) => (
        <button
          key={incident.id}
          type="button"
          onClick={() => onSelectIncident(incident.id)}
          className={`w-full rounded-xl border p-3 text-left transition hover:bg-white/[0.06] ${
            incident.urgency === "critical"
              ? "border-red-400/40 bg-red-500/10"
              : "border-white/10 bg-[#040f16]"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-slate-400">
              {getIncidentDisplayId(incident)}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${urgencyBadgeClass[incident.urgency]}`}
            >
              {urgencyLabel[incident.urgency]}
            </span>
          </div>
          <h4 className="mt-2 text-sm font-semibold text-slate-100">
            {formatIncidentType(incident.incident_type)}
          </h4>
          <p className="mt-1 text-xs capitalize text-slate-400">
            {formatStatusLabel(incident.status)}
            {incident.location ? ` / ${incident.location}` : ""}
          </p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">
            {incident.summary ?? "No summary available yet."}
          </p>
        </button>
      ))}
    </div>
  );
}
