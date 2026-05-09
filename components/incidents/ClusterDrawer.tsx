"use client";

import type { ReactNode } from "react";
import { useDashboardPersona } from "@/components/dashboard/DashboardPersonaContext";
import type { Incident, SurgeCluster } from "@/lib/types";
import { ClusterIncidentList } from "@/components/incidents/ClusterIncidentList";
import {
  estimateClusterRadiusMeters,
  getClusterIncidents,
  getClusterMode,
  getClusterPriorityScore,
} from "@/lib/map/clustering";
import { formatStatusLabel } from "@/lib/map/incidentStyling";

type ClusterDrawerProps = {
  cluster: SurgeCluster;
  incidents: Incident[];
  onSelectIncident: (incidentId: string) => void;
};

const urgencyOrder = ["critical", "urgent", "non_emergency", "unknown"] as const;

export function ClusterDrawer({
  cluster,
  incidents,
  onSelectIncident,
}: ClusterDrawerProps) {
  const { visibility } = useDashboardPersona();
  const clusterIncidents = getClusterIncidents(cluster, incidents);
  const mode = getClusterMode(cluster, incidents);
  const radiusMeters = estimateClusterRadiusMeters(cluster, incidents);
  const priorityScore = getClusterPriorityScore(cluster, incidents);

  return (
    <aside className="flex min-h-0 flex-col border-l border-white/10 bg-[#000814] text-white">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
          Selected Cluster
        </p>
        <h2 className="mt-2 text-xl font-semibold">{cluster.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {cluster.summary || "No cluster summary is available yet."}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <section className="grid grid-cols-2 gap-3">
          <Detail label="Mode" value={formatStatusLabel(mode)} />
          <Detail label="Incident count" value={cluster.incident_count} />
          <Detail
            label="Center"
            value={
              cluster.center
                ? `${cluster.center.lat.toFixed(4)}, ${cluster.center.lng.toFixed(4)}`
                : "Not available"
            }
          />
          <Detail
            label="Radius"
            value={radiusMeters === null ? "Not available" : `${radiusMeters} m`}
          />
          <Detail
            label="Priority"
            value={priorityScore === null ? "Not scored" : priorityScore}
          />
          {visibility.showClusterDrawerTechnicalIds ? (
            <Detail label="Cluster ID" value={<Code>{cluster.cluster_id}</Code>} />
          ) : null}
        </section>

        <Section title="Urgency Breakdown">
          <div className="grid grid-cols-2 gap-2">
            {urgencyOrder.map((urgency) => (
              <div
                key={urgency}
                className="rounded-xl border border-white/10 bg-[#040f16] p-3"
              >
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  {formatStatusLabel(urgency)}
                </dt>
                <dd className="mt-1 text-lg font-semibold text-slate-100">
                  {cluster.urgency_breakdown[urgency] ?? 0}
                </dd>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Top Recommended Action">
          <p className="rounded-2xl border border-cyan-300/15 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-50 shadow-lg shadow-cyan-950/25">
            {cluster.top_recommended_action ?? "No recommendation yet."}
          </p>
        </Section>

        <Section title="Incidents In Cluster">
          <ClusterIncidentList
            incidents={clusterIncidents}
            onSelectIncident={onSelectIncident}
          />
        </Section>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#040f16] p-3">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-200">{value}</dd>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-xs text-slate-300">{children}</code>;
}
