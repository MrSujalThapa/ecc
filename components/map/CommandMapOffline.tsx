"use client";

import type { KeyboardEvent } from "react";
import type { Incident } from "@/lib/types";
import {
  formatIncidentType,
  getIncidentDisplayId,
  urgencyBadgeClass,
} from "@/lib/map/incidentStyling";

type CommandMapOfflineProps = {
  incidents: Incident[];
  selectedIncidentId: string | null;
  onSelectIncident: (incidentId: string) => void;
};

export const CommandMapOffline = ({
  incidents,
  selectedIncidentId,
  onSelectIncident,
}: CommandMapOfflineProps) => {
  const pinnedCount = incidents.filter((i) => i.coordinates !== null).length;
  const awaitingLocationCount = incidents.length - pinnedCount;

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    incidentId: string,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    onSelectIncident(incidentId);
  };

  return (
    <div className="flex h-full min-h-[420px] w-full flex-col bg-[#000814] text-white">
      <div className="border-b border-white/10 bg-[#000814]/90 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
          Command map (offline)
        </p>
        <p className="mt-1 text-sm text-slate-300">
          {pinnedCount} with coordinates · {awaitingLocationCount} awaiting location
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          No <code className="text-slate-300">NEXT_PUBLIC_MAPBOX_TOKEN</code> — use
          this list to test incidents, sessions, and Realtime. For the real map, add
          a free token from{" "}
          <a
            className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
            href="https://account.mapbox.com/access-tokens/"
            rel="noreferrer"
            target="_blank"
          >
            mapbox.com/access-tokens
          </a>
          .
        </p>
      </div>

      <ul
        aria-label="Incidents for map selection"
        className="min-h-0 flex-1 list-none overflow-y-auto p-3"
        role="list"
      >
        {incidents.length === 0 ? (
          <li className="rounded-xl border border-white/10 bg-[#000814]/60 p-4 text-sm text-slate-400">
            No incidents loaded yet.
          </li>
        ) : (
          incidents.map((incident) => {
            const isSelected = selectedIncidentId === incident.id;
            const coords = incident.coordinates;
            const coordsLabel = coords
              ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
              : "No coordinates";

            return (
              <li className="mb-2" key={incident.id} role="listitem">
                <button
                  aria-label={`Select incident ${getIncidentDisplayId(incident)}`}
                  aria-pressed={isSelected}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                    isSelected
                      ? "border-cyan-400/60 bg-cyan-950/40"
                      : "border-white/10 bg-[#000814]/50 hover:border-white/20 hover:bg-[#000814]/80"
                  }`}
                  onClick={() => onSelectIncident(incident.id)}
                  onKeyDown={(e) => handleKeyDown(e, incident.id)}
                  type="button"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${urgencyBadgeClass[incident.urgency]}`}
                    >
                      {incident.urgency.replace("_", " ")}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      {getIncidentDisplayId(incident)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {formatIncidentType(incident.incident_type)}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">{coordsLabel}</p>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
};
