import type { Incident } from "@/lib/types";

type StatusMetricsProps = {
  incidents: Incident[];
};

export function getDashboardMetrics(incidents: Incident[]) {
  const activeIncidents = incidents.filter(
    (incident) => incident.status !== "resolved" && incident.status !== "abandoned",
  );
  const criticalIncidents = incidents.filter(
    (incident) => incident.urgency === "critical",
  );
  const humanActiveIncidents = incidents.filter(
    (incident) => incident.control_state === "human_active",
  );
  const operatorRequiredIncidents = incidents.filter(
    (incident) => incident.operator_required === true,
  );
  const assignedOperatorIds = new Set(
    incidents
      .map((incident) => incident.assigned_operator)
      .filter((operator): operator is string => Boolean(operator)),
  );

  return {
    activeCount: activeIncidents.length,
    criticalCount: criticalIncidents.length,
    humanActiveCount: humanActiveIncidents.length,
    operatorRequiredCount: operatorRequiredIncidents.length,
    assignedOperatorCount: assignedOperatorIds.size,
    operatorLoadPercent:
      activeIncidents.length === 0
        ? 0
        : Math.round((humanActiveIncidents.length / activeIncidents.length) * 100),
  };
}

export function StatusMetrics({ incidents }: StatusMetricsProps) {
  const metrics = getDashboardMetrics(incidents);

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <Metric label="Active calls" value={metrics.activeCount.toString()} />
      <Metric
        label="Critical"
        value={metrics.criticalCount.toString()}
        tone="critical"
      />
      <Metric label="Operator load" value={`${metrics.operatorLoadPercent}%`} />
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "critical";
}) {
  return (
    <div className="min-w-24 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <div
        className={`text-lg font-semibold ${
          tone === "critical" ? "text-red-200" : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="text-[0.65rem] uppercase tracking-wide text-slate-400">
        {label}
      </div>
    </div>
  );
}
