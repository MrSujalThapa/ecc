"use client";

import { useMemo, useState } from "react";
import type { CallSession, Incident } from "@/lib/types";
import {
  buildMultilingualSummary,
  type MultilingualSummaryItem,
} from "@/lib/dashboard/buildMultilingualSummary";

type MultilingualTracePanelProps = {
  incident: Incident;
  activeCallSession?: CallSession | null;
};

const toneClasses: Record<NonNullable<MultilingualSummaryItem["tone"]>, string> = {
  default: "border-white/10 bg-[#040f16] text-slate-200",
  info: "border-cyan-300/20 bg-cyan-500/10 text-cyan-50",
  warning: "border-amber-300/20 bg-amber-500/10 text-amber-50",
};

export function MultilingualTracePanel({
  incident,
  activeCallSession = null,
}: MultilingualTracePanelProps) {
  const [expanded, setExpanded] = useState(true);
  const summary = useMemo(
    () => buildMultilingualSummary({ incident, activeCallSession }),
    [activeCallSession, incident],
  );

  const items = [
    summary.caller_language,
    summary.translation_status,
    summary.original_transcript,
    summary.english_transcript,
    summary.ai_reply_language,
    summary.operator_summary,
  ];

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
            Multilingual Visibility
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Available language and translation details for this incident.
          </p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-white/10 px-4 py-4">
          <div className="grid gap-3">
            {items.map((item) => (
              <TraceItem key={item.label} item={item} />
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#040f16] p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Notes
            </p>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-300">
              {summary.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TraceItem({ item }: { item: MultilingualSummaryItem }) {
  const tone = item.tone ?? "default";

  return (
    <div className={`rounded-xl border p-3 ${toneClasses[tone]}`}>
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {item.label}
      </dt>
      <dd className="mt-1 break-words text-sm leading-6">{item.value}</dd>
    </div>
  );
}
