"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  OperatorResolveResponse,
  OperatorSendSmsResponse,
  OperatorTakeoverResponse,
  OperatorUpdateIncidentResponse,
} from "@/lib/types/api";
import type { Incident } from "@/lib/types/domain";
import {
  OPERATOR_SIM_OPERATOR_ID,
  buildOperatorSimResolve,
  buildOperatorSimSendSms,
  buildOperatorSimTakeover,
  buildOperatorSimUpdateSummary,
} from "@/lib/simulate/operator-flow-sim";

type PersistenceState = { checked: boolean; uses_supabase: boolean };

const postJson = async <T,>(
  url: string,
  body: unknown
): Promise<{ ok: boolean; status: number; data: T | null; errorText: string }> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const errorText = await res.text();
  let data: T | null = null;
  try {
    data = JSON.parse(errorText) as T;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data, errorText };
};

export const OperatorFlowSimulator = () => {
  const [persistence, setPersistence] = useState<PersistenceState>({
    checked: false,
    uses_supabase: false,
  });
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("Operator sim: reviewed on dashboard.");
  const [smsDraft, setSmsDraft] = useState("Your report was updated. Ref: see dashboard.");
  const [resolutionNote, setResolutionNote] = useState("Closed via operator flow simulator.");
  const [busy, setBusy] = useState(false);
  const [listBusy, setListBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [...prev.slice(-40), `${new Date().toISOString().slice(11, 19)} ${line}`]);
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/dev/persistence");
        const j = (await res.json()) as { uses_supabase?: boolean };
        setPersistence({ checked: true, uses_supabase: Boolean(j.uses_supabase) });
      } catch {
        setPersistence({ checked: true, uses_supabase: false });
      }
    };
    void run();
  }, []);

  const handleRefreshIncidents = useCallback(async () => {
    setListBusy(true);
    setLastError(null);
    try {
      const res = await fetch("/api/dev/incidents?limit=50");
      const j = (await res.json()) as { incidents?: Incident[]; error?: string };
      if (!res.ok) {
        const msg = `GET /api/dev/incidents ${res.status}: ${j.error ?? "failed"}`;
        setLastError(msg);
        appendLog(msg);
        setIncidents([]);
        setListBusy(false);
        return;
      }
      const rows = j.incidents ?? [];
      setIncidents(rows);
      appendLog(
        `Loaded ${rows.length} incident(s) from ${persistence.uses_supabase ? "Supabase" : "in-memory store"}`
      );
      setSelectedId((prev) => {
        if (rows.length === 0) return "";
        if (rows.some((i) => i.id === prev)) return prev;
        return rows[0]!.id;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fetch failed";
      setLastError(msg);
      appendLog(msg);
    }
    setListBusy(false);
  }, [appendLog, persistence.uses_supabase]);

  useEffect(() => {
    if (!persistence.checked) return;
    const id = setTimeout(() => {
      void handleRefreshIncidents();
    }, 0);
    return () => clearTimeout(id);
  }, [persistence.checked, handleRefreshIncidents]);

  const requireSelection = (): string | null => {
    if (!selectedId.trim()) {
      setLastError("Select an incident from the list (refresh if empty).");
      return null;
    }
    return selectedId.trim();
  };

  const handleTakeover = async () => {
    const id = requireSelection();
    if (!id) return;
    setBusy(true);
    setLastError(null);
    const body = buildOperatorSimTakeover(id);
    const { ok, status, data, errorText } = await postJson<OperatorTakeoverResponse>(
      "/api/operator/takeover",
      body
    );
    if (!ok || !data) {
      const msg = `operator/takeover ${status}: ${errorText.slice(0, 500)}`;
      setLastError(msg);
      appendLog(msg);
      setBusy(false);
      return;
    }
    appendLog(`takeover → status=${data.incident.status}, transfer=${data.transfer_status}`);
    setBusy(false);
    await handleRefreshIncidents();
  };

  const handleUpdateSummary = async () => {
    const id = requireSelection();
    if (!id) return;
    const summary = summaryDraft.trim();
    if (!summary) {
      setLastError("Enter a summary for the patch.");
      return;
    }
    setBusy(true);
    setLastError(null);
    const body = buildOperatorSimUpdateSummary(id, summary);
    const { ok, status, data, errorText } = await postJson<OperatorUpdateIncidentResponse>(
      "/api/operator/update-incident",
      body
    );
    if (!ok || !data) {
      const msg = `operator/update-incident ${status}: ${errorText.slice(0, 500)}`;
      setLastError(msg);
      appendLog(msg);
      setBusy(false);
      return;
    }
    appendLog(`update-incident → last_updated_by=${data.incident.last_updated_by}`);
    setBusy(false);
    await handleRefreshIncidents();
  };

  const handleSendSms = async () => {
    const id = requireSelection();
    if (!id) return;
    const message = smsDraft.trim();
    if (!message) {
      setLastError("Enter SMS body.");
      return;
    }
    setBusy(true);
    setLastError(null);
    const body = buildOperatorSimSendSms(id, message);
    const { ok, status, data, errorText } = await postJson<OperatorSendSmsResponse>(
      "/api/operator/send-sms",
      body
    );
    if (!ok || !data) {
      const msg = `operator/send-sms ${status}: ${errorText.slice(0, 500)}`;
      setLastError(msg);
      appendLog(msg);
      setBusy(false);
      return;
    }
    appendLog(`send-sms → sent=${String(data.sent)}`);
    setBusy(false);
    await handleRefreshIncidents();
  };

  const handleResolve = async () => {
    const id = requireSelection();
    if (!id) return;
    setBusy(true);
    setLastError(null);
    const body = buildOperatorSimResolve(id, resolutionNote.trim() || null);
    const { ok, status, data, errorText } = await postJson<OperatorResolveResponse>(
      "/api/operator/resolve",
      body
    );
    if (!ok || !data) {
      const msg = `operator/resolve ${status}: ${errorText.slice(0, 500)}`;
      setLastError(msg);
      appendLog(msg);
      setBusy(false);
      return;
    }
    appendLog(`resolve → status=${data.incident.status}`);
    setBusy(false);
    await handleRefreshIncidents();
  };

  const controlsDisabled = busy || listBusy;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 text-zinc-900 dark:text-zinc-50">
      <div
        className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        role="status"
        aria-live="polite"
      >
        {persistence.checked ? (
          <p>
            <strong className="font-medium">Operator sim:</strong> loads rows via{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">GET /api/dev/incidents</code>{" "}
            (same persistence as voice sim — {persistence.uses_supabase ? "Supabase" : "in-memory"}). Then POSTs the
            real <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">/api/operator/*</code>{" "}
            routes using <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">{OPERATOR_SIM_OPERATOR_ID}</code>.
          </p>
        ) : (
          <p>Checking persistence…</p>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Incidents (from store / Supabase)</h2>
          <button
            type="button"
            onClick={() => void handleRefreshIncidents()}
            disabled={controlsDisabled || !persistence.checked}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-600"
            aria-label="Refresh incident list"
          >
            {listBusy ? "Loading…" : "Refresh list"}
          </button>
        </div>
        {incidents.length === 0 && persistence.checked && !listBusy ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No incidents yet. Start a call in the voice simulator above, or insert rows in Supabase, then refresh.
          </p>
        ) : null}
        <label htmlFor="operator-sim-incident" className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Selected incident
        </label>
        <select
          id="operator-sim-incident"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={controlsDisabled || incidents.length === 0}
          className="mt-1 w-full max-w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          aria-label="Incident to apply operator actions"
        >
          <option value="">—</option>
          {incidents.map((i) => (
            <option key={i.id} value={i.id}>
              {i.public_id ?? i.id.slice(0, 8)} · {i.status} · {i.urgency} · {i.updated_at.slice(0, 19)}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Operator actions</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleTakeover()}
            disabled={controlsDisabled || !selectedId}
            className="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            POST /api/operator/takeover
          </button>
        </div>
        <div className="mt-4 space-y-2">
          <label htmlFor="operator-sim-summary" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Summary patch
          </label>
          <textarea
            id="operator-sim-summary"
            value={summaryDraft}
            onChange={(e) => setSummaryDraft(e.target.value)}
            rows={2}
            disabled={controlsDisabled}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            aria-label="Operator summary patch"
          />
          <button
            type="button"
            onClick={() => void handleUpdateSummary()}
            disabled={controlsDisabled || !selectedId}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-600"
          >
            POST /api/operator/update-incident
          </button>
        </div>
        <div className="mt-4 space-y-2">
          <label htmlFor="operator-sim-sms" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            SMS body
          </label>
          <textarea
            id="operator-sim-sms"
            value={smsDraft}
            onChange={(e) => setSmsDraft(e.target.value)}
            rows={2}
            disabled={controlsDisabled}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            aria-label="SMS message body"
          />
          <button
            type="button"
            onClick={() => void handleSendSms()}
            disabled={controlsDisabled || !selectedId}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-600"
          >
            POST /api/operator/send-sms
          </button>
        </div>
        <div className="mt-4 space-y-2">
          <label htmlFor="operator-sim-resolve" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Resolution note (optional)
          </label>
          <textarea
            id="operator-sim-resolve"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            rows={2}
            disabled={controlsDisabled}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            aria-label="Resolution note"
          />
          <button
            type="button"
            onClick={() => void handleResolve()}
            disabled={controlsDisabled || !selectedId}
            className="rounded-md bg-emerald-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            POST /api/operator/resolve
          </button>
        </div>
      </div>

      {lastError ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
          role="alert"
        >
          {lastError}
        </p>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Operator activity log</h3>
        <ul className="mt-2 max-h-40 overflow-auto font-mono text-xs text-zinc-600 dark:text-zinc-400">
          {log.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
