import type { ReactNode } from "react";
import type { AppMode, Incident, Urgency } from "@/lib/types";
import { APP_MODES, URGENCY_LEVELS } from "@/lib/types";
import { IncidentCard } from "@/components/incidents/IncidentCard";
import { formatStatusLabel, sortIncidentsForQueue } from "@/lib/map/incidentStyling";

export type IncidentQueueFilters = {
  mode: AppMode | "all";
  urgency: Urgency | "all";
  status: string | "all";
  assignedOperator: string | "all" | "unassigned";
};

type IncidentQueueProps = {
  incidents: Incident[];
  allIncidents: Incident[];
  selectedIncidentId: string | null;
  filters: IncidentQueueFilters;
  onFiltersChange: (filters: IncidentQueueFilters) => void;
  onSelectIncident: (incidentId: string) => void;
};

export function IncidentQueue({
  incidents,
  allIncidents,
  selectedIncidentId,
  filters,
  onFiltersChange,
  onSelectIncident,
}: IncidentQueueProps) {
  const sorted = sortIncidentsForQueue(incidents);
  const statuses = Array.from(
    new Set(allIncidents.map((incident) => incident.status)),
  ).sort();
  const assignedOperators = Array.from(
    new Set(
      allIncidents
        .map((incident) => incident.assigned_operator)
        .filter((operator): operator is string => Boolean(operator)),
    ),
  ).sort();

  const updateFilters = (nextFilters: Partial<IncidentQueueFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  return (
    <aside className="flex min-h-0 flex-col border-r border-white/10 bg-[#000814] text-white">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#000814]/90 px-4 py-4 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
          Incident Queue
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight">
            {sorted.length} <span className="text-slate-400">shown</span>
          </h2>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <FilterSelect
            label="Mode"
            value={filters.mode}
            onChange={(value) =>
              updateFilters({ mode: value as IncidentQueueFilters["mode"] })
            }
          >
            <option value="all">All modes</option>
            {APP_MODES.map((modeOption) => (
              <option key={modeOption} value={modeOption}>
                {modeOption.replace("_", " ")}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Urgency"
            value={filters.urgency}
            onChange={(value) =>
              updateFilters({
                urgency: value as IncidentQueueFilters["urgency"],
              })
            }
          >
            <option value="all">All urgency</option>
            {URGENCY_LEVELS.map((urgencyOption) => (
              <option key={urgencyOption} value={urgencyOption}>
                {urgencyOption.replace("_", " ")}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(value) => updateFilters({ status: value })}
          >
            <option value="all">All status</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Operator"
            value={filters.assignedOperator}
            onChange={(value) => updateFilters({ assignedOperator: value })}
          >
            <option value="all">All operators</option>
            <option value="unassigned">Unassigned</option>
            {assignedOperators.map((operator) => (
              <option key={operator} value={operator}>
                {operator}
              </option>
            ))}
          </FilterSelect>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-slate-400">
            No incidents match the current filters. Adjust the queue filters or
            refresh the feed.
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                selected={incident.id === selectedIncidentId}
                onSelectIncident={onSelectIncident}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function FilterSelect({
  label,
  value,
  children,
  onChange,
}: {
  label: string;
  value: string;
  children: ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-white/10 bg-[#000814] px-2 py-2 text-xs normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300"
      >
        {children}
      </select>
    </label>
  );
}
