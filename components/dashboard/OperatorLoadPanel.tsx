import type { Incident } from "@/lib/types";
import { getDashboardMetrics } from "@/components/dashboard/StatusMetrics";

type OperatorLoadPanelProps = {
  incidents: Incident[];
  /** When false, only the title and progress bar are shown (executive persona). */
  showBreakdownLine?: boolean;
};

export function OperatorLoadPanel({
  incidents,
  showBreakdownLine = true,
}: OperatorLoadPanelProps) {
  const metrics = getDashboardMetrics(incidents);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Operator Load
        </span>
        <span className="font-semibold text-cyan-100">
          {metrics.operatorLoadPercent}%
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-[#000814]">
        <div
          className="h-2 rounded-full bg-cyan-300"
          style={{ width: `${Math.min(metrics.operatorLoadPercent, 100)}%` }}
        />
      </div>
      {showBreakdownLine ? (
        <p className="mt-2 text-xs text-slate-400">
          {metrics.humanActiveCount} human active /{" "}
          {metrics.operatorRequiredCount} require operators /{" "}
          {metrics.assignedOperatorCount} assigned
        </p>
      ) : null}
    </div>
  );
}
