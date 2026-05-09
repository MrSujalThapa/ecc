import type { AppMode, Incident } from "@/lib/types";
import { ModeSwitcher } from "@/components/dashboard/ModeSwitcher";
import { OperatorLoadPanel } from "@/components/dashboard/OperatorLoadPanel";
import { StatusMetrics } from "@/components/dashboard/StatusMetrics";

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
        <ModeSwitcher mode={mode} onModeChange={onModeChange} />

        <StatusMetrics incidents={incidents} />
        <OperatorLoadPanel incidents={incidents} />

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="rounded-full border border-[rgba(112,214,255,0.38)] px-4 py-2 text-sm font-medium text-[#dbe7f3] transition hover:bg-[#0b1728] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>

        {usingFallback ? (
          <span className="rounded-full border border-[rgba(112,214,255,0.18)] bg-[#0b1728] px-3 py-1 text-xs font-medium text-[#8b9bb0]">
            Demo fallback
          </span>
        ) : null}
        {realtimeConnected ? (
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
