"use client";

import { useMemo, useState } from "react";
import type { CallSession, Incident } from "@/lib/types";
import {
  buildAITraceSummary,
  type AITraceSummaryItem,
} from "@/lib/dashboard/buildAITraceSummary";

type AITracePanelProps = {
  incident: Incident;
  activeCallSession?: CallSession | null;
};

const toneClasses: Record<NonNullable<AITraceSummaryItem["tone"]>, string> = {
  default: "border-white/10 bg-[#040f16] text-slate-200",
  info: "border-cyan-300/20 bg-cyan-500/10 text-cyan-50",
  warning: "border-amber-300/20 bg-amber-500/10 text-amber-50",
};

export function AITracePanel({
  incident,
  activeCallSession = null,
}: AITracePanelProps) {
  const [expanded, setExpanded] = useState(true);
  const summary = useMemo(
    () => buildAITraceSummary(incident, activeCallSession),
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
            AI Trace
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Existing AI/runtime metadata available to the dashboard drawer.
          </p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-5 border-t border-white/10 px-4 py-4">
          <TraceGroup title="Recommendation" items={summary.recommendation} />
          <TraceGroup title="Escalation" items={summary.escalation} />
          <TraceGroup title="Confidence" items={summary.confidence} />
          <TraceGroup title="Trace Availability" items={summary.trace} />
        </div>
      ) : null}
    </section>
  );
}

function TraceGroup({
  title,
  items,
}: {
  title: string;
  items: AITraceSummaryItem[];
}) {
  return (
    <div>
      <h5 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
        {title}
      </h5>
      <div className="grid gap-3">
        {items.map((item) => (
          <TraceItem key={`${title}-${item.label}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function TraceItem({ item }: { item: AITraceSummaryItem }) {
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
