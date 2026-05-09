"use client";

import type { ChangeEvent } from "react";
import type { AppMode, Incident } from "@/lib/types";
import { ModeSwitcher } from "@/components/dashboard/ModeSwitcher";
import { OperatorLoadPanel } from "@/components/dashboard/OperatorLoadPanel";
import { StatusMetrics } from "@/components/dashboard/StatusMetrics";
import { useDashboardPersona } from "@/components/dashboard/DashboardPersonaContext";
import {
  DASHBOARD_PERSONA_OPTIONS,
  type DashboardPersonaId,
} from "@/lib/dashboard/dashboardPersona";

const modeBadgeClass: Record<AppMode | "all", string> = {
  all: "border-[rgba(112,214,255,0.18)] bg-[#0b1728] text-[#8b9bb0]",
  normal: "border-[rgba(112,214,255,0.38)] bg-[#06111f] text-[#70d6ff]",
  disaster: "border-[rgba(112,214,255,0.18)] bg-[#bg-[#000814]] text-[#dbe7f3]",
  world_cup: "border-[rgba(112,214,255,0.18)] bg-[#0b1728] text-[#dbe7f3]",
};

type TopBarProps = {
  incidents: Incident[];
  mode: AppMode | "all";
  onModeChange: (mode: AppMode | "all") => void;
  usingFallback: boolean;
  realtimeConnected?: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
};

export function TopBar({
  incidents,
  mode,
  onModeChange,
  usingFallback,
  realtimeConnected,
  onRefresh,
  isRefreshing,
}: TopBarProps) {
  const { persona, setPersona, visibility } = useDashboardPersona();

  const handlePersonaChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setPersona(event.target.value as DashboardPersonaId);
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(112,214,255,0.18)] bg-[#000814]/95 px-5 py-4 text-[#dbe7f3] backdrop-blur">
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#8b9bb0]">
          ECC
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-[#dbe7f3]">
            Emergency Command Center
          </h1>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${modeBadgeClass[mode]}`}
            title="Current incident filter mode"
          >
            {mode === "all" ? "All modes" : mode.replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[10rem] flex-col gap-1">
          <label
            htmlFor="dashboard-persona"
            className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-slate-500"
          >
            Persona
          </label>
          <select
            id="dashboard-persona"
            value={persona}
            onChange={handlePersonaChange}
            className="rounded-lg border border-white/15 bg-[#06111f] px-2 py-1.5 text-xs font-medium text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            title={DASHBOARD_PERSONA_OPTIONS.find((o) => o.id === persona)?.description}
            aria-label={`Dashboard persona: ${DASHBOARD_PERSONA_OPTIONS.find((o) => o.id === persona)?.label ?? persona}`}
          >
            {DASHBOARD_PERSONA_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <ModeSwitcher mode={mode} onModeChange={onModeChange} />

        <StatusMetrics incidents={incidents} />
        {visibility.showOperatorLoadPanel ? (
          <OperatorLoadPanel
            incidents={incidents}
            showBreakdownLine={visibility.showOperatorLoadBreakdownLine}
          />
        ) : null}

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="rounded-full border border-[rgba(112,214,255,0.38)] px-4 py-2 text-sm font-medium text-[#dbe7f3] transition hover:bg-[#0b1728] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>

        {visibility.showInfraStatusBadges && usingFallback ? (
          <span className="rounded-full border border-[rgba(112,214,255,0.18)] bg-[#0b1728] px-3 py-1 text-xs font-medium text-[#8b9bb0]">
            Demo fallback
          </span>
        ) : null}
        {visibility.showInfraStatusBadges && realtimeConnected ? (
          <span
            className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-100"
            title="Subscribed to Supabase Realtime on public.incidents"
          >
            Realtime
          </span>
        ) : null}
      </div>
    </header>
  );
}
