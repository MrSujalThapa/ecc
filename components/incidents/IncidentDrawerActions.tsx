"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import type { Incident } from "@/lib/types/domain";
import {
  dashboardPostOperatorResolve,
  dashboardPostOperatorSendSms,
  dashboardPostOperatorTakeover,
  dashboardPostOperatorUpdateIncident,
} from "@/lib/data/dashboardCommandApi";
import {
  buildOperatorSimResolve,
  buildOperatorSimSendSms,
  buildOperatorSimTakeover,
  buildOperatorSimUpdateSummary,
} from "@/lib/simulate/operator-flow-sim";

type IncidentDrawerActionsProps = {
  incident: Incident;
  onAfterCommand: () => Promise<void>;
};

export const IncidentDrawerActions = ({
  incident,
  onAfterCommand,
}: IncidentDrawerActionsProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smsBody, setSmsBody] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  const run = useCallback(
    async (
      label: string,
      fn: () => Promise<{ ok: boolean; errorText: string; status: number }>
    ) => {
      setBusy(true);
      setError(null);
      const { ok, errorText, status } = await fn();
      if (!ok) {
        setError(`${label} failed (${status}): ${errorText.slice(0, 400)}`);
        setBusy(false);
        return;
      }
      await onAfterCommand();
      setBusy(false);
    },
    [onAfterCommand]
  );

  const handleTakeover = () => {
    void run("Take over", async () => {
      const body = buildOperatorSimTakeover(incident.id);
      const r = await dashboardPostOperatorTakeover(body);
      return { ok: r.ok, errorText: r.errorText, status: r.status };
    });
  };

  const handleResolve = () => {
    void run("Resolve", async () => {
      const body = buildOperatorSimResolve(
        incident.id,
        resolutionNote.trim() || null
      );
      const r = await dashboardPostOperatorResolve(body);
      return { ok: r.ok, errorText: r.errorText, status: r.status };
    });
  };

  const handleSendSms = () => {
    const message = smsBody.trim();
    if (!message) {
      setError("Enter SMS text.");
      return;
    }
    void run("Send SMS", async () => {
      const body = buildOperatorSimSendSms(incident.id, message);
      const r = await dashboardPostOperatorSendSms(body);
      return { ok: r.ok, errorText: r.errorText, status: r.status };
    });
  };

  const handleUpdateSummary = () => {
    const summary = summaryDraft.trim();
    if (!summary) {
      setError("Enter a summary to save.");
      return;
    }
    void run("Update incident", async () => {
      const body = buildOperatorSimUpdateSummary(incident.id, summary);
      const r = await dashboardPostOperatorUpdateIncident(body);
      return { ok: r.ok, errorText: r.errorText, status: r.status };
    });
  };

  return (
    <Section title="Operator actions">
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        Actions use <code className="text-slate-400">POST /api/operator/*</code> per{" "}
        <code className="text-slate-400">docs/api_contracts.md</code>. The list refreshes after
        each successful request.
      </p>

      {error ? (
        <p className="mb-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <div className="space-y-3" role="group" aria-label="Operator actions">
        <div className="flex flex-wrap gap-2">
          <ActionButton disabled={busy} label="Take over" onClick={handleTakeover} />
          <ActionButton disabled={busy} label="Mark resolved" onClick={handleResolve} />
        </div>
        <label className="block text-xs text-slate-400" htmlFor="drawer-resolution-note">
          Resolution note (optional)
        </label>
        <textarea
          className="w-full rounded-lg border border-white/10 bg-[#000814] px-3 py-2 text-sm text-slate-100"
          disabled={busy}
          id="drawer-resolution-note"
          onChange={(e) => setResolutionNote(e.target.value)}
          placeholder="Note stored with resolve request"
          rows={2}
          value={resolutionNote}
        />
        <label className="block text-xs text-slate-400" htmlFor="drawer-sms">
          SMS message
        </label>
        <textarea
          className="w-full rounded-lg border border-white/10 bg-[#000814] px-3 py-2 text-sm text-slate-100"
          disabled={busy}
          id="drawer-sms"
          onChange={(e) => setSmsBody(e.target.value)}
          placeholder="Message body for POST /api/operator/send-sms"
          rows={2}
          value={smsBody}
        />
        <ActionButton disabled={busy} label="Send SMS" onClick={handleSendSms} />
        <label className="block text-xs text-slate-400" htmlFor="drawer-summary">
          Summary update
        </label>
        <textarea
          className="w-full rounded-lg border border-white/10 bg-[#000814] px-3 py-2 text-sm text-slate-100"
          disabled={busy}
          id="drawer-summary"
          onChange={(e) => setSummaryDraft(e.target.value)}
          placeholder="Patch incident summary via POST /api/operator/update-incident"
          rows={2}
          value={summaryDraft}
        />
        <ActionButton disabled={busy} label="Update summary" onClick={handleUpdateSummary} />
      </div>
    </Section>
  );
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="border-t border-white/10 pt-5">
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
      {title}
    </h3>
    {children}
  </section>
);

const ActionButton = ({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) => (
  <button
    aria-busy={disabled}
    className="rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:opacity-50"
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    {label}
  </button>
);
