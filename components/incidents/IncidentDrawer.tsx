"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import type { CallSession, Incident } from "@/lib/types";
import type { OperatorActions } from "@/lib/data/operatorActions";
import { MissingFieldsChecklist } from "@/components/incidents/MissingFieldsChecklist";
import { CallControlPanel } from "@/components/voice/CallControlPanel";
import { LiveTranscriptPanel } from "@/components/voice/LiveTranscriptPanel";
import { useDashboardPersona } from "@/components/dashboard/DashboardPersonaContext";
import {
  formatIncidentType,
  formatNullable,
  formatStatusLabel,
  formatTimestamp,
  getIncidentDisplayId,
  urgencyBadgeClass,
  urgencyLabel,
} from "@/lib/map/incidentStyling";

const modeBadgeClass: Record<string, string> = {
  normal: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
  disaster: "border-orange-400/30 bg-orange-500/10 text-orange-100",
  world_cup: "border-violet-400/30 bg-violet-500/10 text-violet-100",
};

const INCIDENT_DRAWER_TABS = [
  { id: "triage" as const, label: "Triage" },
  { id: "operator" as const, label: "Operator" },
  { id: "details" as const, label: "Details" },
  { id: "transcript" as const, label: "Live voice" },
];

type IncidentDrawerTab = (typeof INCIDENT_DRAWER_TABS)[number]["id"];

type IncidentDrawerProps = {
  incident: Incident | null;
  operatorActions: OperatorActions;
  onActionComplete: () => Promise<void> | void;
  /** Latest rows from `GET /api/dev/call-sessions?incident_id=...` (active session preferred). */
  activeCallSession?: CallSession | null;
  /** When the incident appears in a derived map cluster, opens the cluster drawer + map focus. */
  onViewCluster?: () => void;
  /** Map cluster id (`local-…`) shown as a link when `onViewCluster` is set. */
  mapClusterId?: string | null;
};

type IncidentDrawerBodyProps = Omit<IncidentDrawerProps, "incident"> & {
  incident: Incident;
};

export function IncidentDrawer({
  incident,
  operatorActions,
  onActionComplete,
  activeCallSession = null,
  onViewCluster,
  mapClusterId = null,
}: IncidentDrawerProps) {
  if (!incident) {
    return (
      <aside className="flex min-h-0 flex-col border-l border-white/10 bg-[#000814] text-white">
        <div className="m-4 rounded-2xl border border-dashed border-white/15 p-5 text-sm text-slate-400">
          Select an incident from the queue or map to view triage details.
        </div>
      </aside>
    );
  }

  return (
    <IncidentDrawerContent
      key={incident.id}
      incident={incident}
      operatorActions={operatorActions}
      onActionComplete={onActionComplete}
      activeCallSession={activeCallSession}
      onViewCluster={onViewCluster}
      mapClusterId={mapClusterId}
    />
  );
}

function IncidentDrawerContent({
  incident,
  operatorActions,
  onActionComplete,
  activeCallSession = null,
  onViewCluster,
  mapClusterId = null,
}: IncidentDrawerBodyProps) {
  const { visibility } = useDashboardPersona();
  const [activeTab, setActiveTab] = useState<IncidentDrawerTab>("triage");

  const handleTabListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const ids = INCIDENT_DRAWER_TABS.map((t) => t.id);
    const index = ids.indexOf(activeTab);
    if (index < 0) {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActiveTab(ids[(index + 1) % ids.length]!);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActiveTab(ids[(index - 1 + ids.length) % ids.length]!);
    }
  };

  const handleTabClick = (tab: IncidentDrawerTab) => {
    setActiveTab(tab);
  };

  return (
    <aside className="flex min-h-0 flex-col border-l border-white/10 bg-[#000814] text-white">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-400">
              {getIncidentDisplayId(incident)}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                modeBadgeClass[incident.mode] ?? "border-white/10 bg-[#040f16] text-slate-200"
              }`}
            >
              {incident.mode.replace("_", " ")}
            </span>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${urgencyBadgeClass[incident.urgency]}`}
          >
            {urgencyLabel[incident.urgency]}
          </span>
        </div>
        <h2 className="mt-3 text-xl font-semibold">
          {formatIncidentType(incident.incident_type)}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {incident.summary ?? "No incident summary has been captured yet."}
        </p>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          role="tablist"
          aria-label="Incident sections"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2"
          onKeyDown={handleTabListKeyDown}
        >
          {INCIDENT_DRAWER_TABS.map(({ id, label }) => {
            const selected = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`incident-drawer-tab-${id}`}
                aria-selected={selected}
                aria-controls={`incident-drawer-panel-${id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => handleTabClick(id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                  selected
                    ? "bg-white/10 text-cyan-100"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div
          id={`incident-drawer-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`incident-drawer-tab-${activeTab}`}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
        >
          {activeTab === "triage" ? (
            <div className="space-y-5">
              <Section title="Recommended action">
                <p className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-50 shadow-lg shadow-cyan-950/30">
                  {incident.recommended_action ?? "No recommendation yet."}
                </p>
              </Section>

              <Section title="Missing fields">
                <MissingFieldsChecklist fields={incident.missing_fields} />
              </Section>
            </div>
          ) : null}

          {activeTab === "operator" ? (
            <div className="space-y-5">
              <CallControlPanel
                incident={incident}
                operatorActions={operatorActions}
                onActionComplete={onActionComplete}
              />
              {visibility.showCallSessionApiBlock && activeCallSession ? (
                <Section title="Call session (API)">
                  <Detail label="Session id" value={activeCallSession.id} />
                  <Detail label="Session status" value={activeCallSession.status} />
                  <Detail
                    label="Turn count"
                    value={String(activeCallSession.turn_count)}
                  />
                  <Detail
                    label="Next question"
                    value={activeCallSession.next_question ?? "None queued"}
                  />
                  <Detail
                    label="Transfer"
                    value={formatStatusLabel(
                      activeCallSession.operator_transfer_status,
                    )}
                  />
                </Section>
              ) : null}
            </div>
          ) : null}

          {activeTab === "details" ? (
            <div className="space-y-5">
              <Section title="Overview">
                <section className="grid grid-cols-2 gap-3">
                  <Detail label="Public ID" value={formatNullable(incident.public_id)} />
                  {visibility.showInternalIncidentId ? (
                    <Detail label="Internal ID" value={<Code>{incident.id}</Code>} />
                  ) : null}
                  <Detail label="Urgency" value={urgencyLabel[incident.urgency]} />
                  <Detail label="Status" value={formatStatusLabel(incident.status)} />
                  {visibility.showDetailsControlAndAi ? (
                    <>
                      <Detail
                        label="Control"
                        value={formatStatusLabel(incident.control_state)}
                      />
                      <Detail label="AI active" value={incident.ai_active ? "Yes" : "No"} />
                    </>
                  ) : null}
                  <Detail
                    label="Operator"
                    value={incident.assigned_operator ?? "Unassigned"}
                  />
                  <Detail
                    label="Operator required"
                    value={
                      incident.operator_required === null
                        ? "Unknown"
                        : incident.operator_required
                          ? "Yes"
                          : "No"
                    }
                  />
                  {visibility.showDetailsPriorityScore ? (
                    <Detail
                      label="Priority score"
                      value={
                        incident.priority_score === null
                          ? "Not scored"
                          : incident.priority_score
                      }
                    />
                  ) : null}
                  <Detail
                    label="Cluster"
                    value={
                      onViewCluster && mapClusterId ? (
                        <button
                          type="button"
                          onClick={onViewCluster}
                          className={`w-full cursor-pointer text-left text-sm leading-snug text-cyan-300 underline decoration-cyan-400/60 underline-offset-2 transition hover:text-cyan-200 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                            visibility.showClusterTechnicalId ? "font-mono text-xs" : ""
                          }`}
                          aria-label={
                            visibility.showClusterTechnicalId
                              ? `Open cluster ${mapClusterId} on the map and in the side panel`
                              : "Open cluster on the map and in the side panel"
                          }
                        >
                          {visibility.showClusterTechnicalId
                            ? mapClusterId
                            : "View cluster on map"}
                        </button>
                      ) : incident.cluster_id ? (
                        visibility.showClusterTechnicalId ? (
                          <span className="font-mono text-xs text-slate-300">
                            {incident.cluster_id}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-200">Linked to a map cluster</span>
                        )
                      ) : (
                        <span className="text-sm text-slate-400">None</span>
                      )
                    }
                  />
                  <Detail label="Updated" value={formatTimestamp(incident.updated_at)} />
                  {visibility.showDetailsUpdatedBy ? (
                    <Detail label="Updated by" value={incident.last_updated_by} />
                  ) : null}
                </section>
              </Section>

              <Section title="Location">
                <Detail
                  label="Status"
                  value={formatStatusLabel(incident.location_status)}
                />
                <Detail label="Address" value={incident.location ?? "Unknown"} />
                {visibility.showLocationCoordinateFields ? (
                  <Detail
                    label="Coordinates"
                    value={
                      incident.coordinates
                        ? `${incident.coordinates.lat.toFixed(4)}, ${incident.coordinates.lng.toFixed(4)}`
                        : "No pin yet"
                    }
                  />
                ) : null}
                <Detail
                  label="Confidence"
                  value={
                    incident.location_confidence === null
                      ? "Unknown"
                      : `${Math.round(incident.location_confidence * 100)}%`
                  }
                />
              </Section>

              <Section title="Collected fields">
                {Object.keys(incident.collected_fields).length > 0 ? (
                  <dl className="space-y-2">
                    {Object.entries(incident.collected_fields).map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-xl border border-white/10 bg-[#040f16] p-3"
                      >
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          {key.replaceAll("_", " ")}
                        </dt>
                        <dd className="mt-1 text-sm text-slate-200">
                          {formatJsonValue(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-slate-400">
                    No structured fields collected yet.
                  </p>
                )}
              </Section>

              <Section title="Custom fields / notes">
                {incident.custom_fields.length > 0 ? (
                  <div className="space-y-2">
                    {incident.custom_fields.map((field, index) => (
                      <pre
                        key={`${incident.id}-custom-${index}`}
                        className="whitespace-pre-wrap rounded-xl border border-white/10 bg-[#040f16] p-3 text-xs leading-5 text-slate-300"
                      >
                        {formatJsonValue(field)}
                      </pre>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    No custom fields or operator notes yet.
                  </p>
                )}
              </Section>
            </div>
          ) : null}

          {activeTab === "transcript" ? (
            <div className="space-y-5">
              <LiveTranscriptPanel incident={incident} />
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
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

function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "Not available";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
