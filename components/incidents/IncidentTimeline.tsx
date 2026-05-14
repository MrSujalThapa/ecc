"use client";

import { useMemo, useState } from "react";
import type { CallSession, Incident } from "@/lib/types";
import { buildIncidentTimeline } from "@/lib/dashboard/buildIncidentTimeline";
import { formatTimestamp } from "@/lib/map/incidentStyling";

type IncidentTimelineProps = {
  incident: Incident;
  activeCallSession?: CallSession | null;
};

const kindClasses: Record<
  ReturnType<typeof buildIncidentTimeline>[number]["kind"],
  string
> = {
  created: "bg-cyan-300",
  status: "bg-slate-300",
  location: "bg-emerald-300",
  triage: "bg-violet-300",
  transfer: "bg-amber-300",
  operator: "bg-orange-300",
  updated: "bg-sky-300",
  note: "bg-slate-500",
};

export function IncidentTimeline({
  incident,
  activeCallSession = null,
}: IncidentTimelineProps) {
  const [expanded, setExpanded] = useState(true);
  const timeline = useMemo(
    () => buildIncidentTimeline({ incident, activeCallSession }),
    [incident, activeCallSession],
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-[#020b12]">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/5"
        aria-expanded={expanded}
      >
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
            Tool / Action Timeline
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Chronological lifecycle events derived from the incident and active call session.
          </p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-white/10 px-4 py-4">
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-400">
              No timeline events are available for this incident yet.
            </p>
          ) : (
            <ol className="space-y-3">
              {timeline.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-[#040f16] p-3"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${kindClasses[item.kind]}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-100">
                          {item.label}
                        </p>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                          {item.kind}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                          {item.source.replaceAll("_", " ")}
                        </span>
                      </div>
                      {item.description ? (
                        <p className="mt-1 text-sm leading-6 text-slate-300">
                          {item.description}
                        </p>
                      ) : null}
                      {item.timestamp ? (
                        <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
                          {formatTimestamp(item.timestamp)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </section>
  );
}
