"use client";

import { useCallback, useEffect, useState } from "react";
import type { CallEndRequest, CallStartResponse, CallTurnResponse } from "@/lib/types/api";
import type { AppMode } from "@/lib/types/enums";
import {
  VOICE_SIM_SAMPLE_UTTERANCES,
  VoiceSimTriagePreviewResponseBody,
  VoiceSimTriageTrace,
  buildVoiceSimCallerTurn,
  buildVoiceSimTriagePreviewBody,
  voiceSimStartForMode,
} from "@/lib/simulate/elevenlabs-voice-sim";

const summarizeToolResult = (
  result: VoiceSimTriageTrace["tool_results"][number]
): string => {
  if (!result.ok) {
    const code = result.error?.code ?? "error";
    const message = result.error?.message ?? "no message";
    return `${result.tool} ✖ ${code} — ${message}`;
  }
  return `${result.tool} ✓ source=${result.source}`;
};

type PersistenceState = { checked: boolean; uses_supabase: boolean };

const postJson = async <T,>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null; errorText: string }> => {
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

export const ElevenLabsVoiceSimulator = () => {
  const [persistence, setPersistence] = useState<PersistenceState>({
    checked: false,
    uses_supabase: false,
  });
  const [mode, setMode] = useState<AppMode>("normal");
  const [incidentId, setIncidentId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [utterance, setUtterance] = useState(VOICE_SIM_SAMPLE_UTTERANCES[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [lastStart, setLastStart] = useState<CallStartResponse | null>(null);
  const [lastTurn, setLastTurn] = useState<CallTurnResponse | null>(null);
  /** Final turns only — fed into triage preview as prior transcript_history. */
  const [committedCallerLines, setCommittedCallerLines] = useState<string[]>([]);
  const [lastTriagePreview, setLastTriagePreview] =
    useState<VoiceSimTriagePreviewResponseBody | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const turnControlsDisabled = busy || incidentId.length === 0;
  const triagePreviewDisabled = busy || !(lastTurn?.incident ?? lastStart?.incident);
  const endCallDisabled = busy || sessionId.length === 0;

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

  const handleStartCall = async () => {
    setBusy(true);
    setLastError(null);
    const body = voiceSimStartForMode(mode);
    const { ok, status, data, errorText } = await postJson<CallStartResponse>("/api/call/start", body);
    if (!ok || !data) {
      const msg = `call/start ${status}: ${errorText.slice(0, 500)}`;
      setLastError(msg);
      appendLog(msg);
      setBusy(false);
      return;
    }
    setLastStart(data);
    setLastTurn(null);
    setCommittedCallerLines([]);
    setLastTriagePreview(null);
    setIncidentId(data.incident_id);
    setSessionId(data.call_session_id);
    appendLog(`call/start → incident ${data.incident_id}, session ${data.call_session_id}`);
    setBusy(false);
  };

  const handleSendTurn = async (isFinal: boolean) => {
    if (!incidentId || !sessionId) {
      setLastError("Start a call first.");
      return;
    }
    const text = utterance.trim();
    if (!text) {
      setLastError("Enter caller text.");
      return;
    }
    setBusy(true);
    setLastError(null);
    const body = buildVoiceSimCallerTurn({
      incident_id: incidentId,
      call_session_id: sessionId,
      text,
      is_final: isFinal,
    });
    const { ok, status, data, errorText } = await postJson<CallTurnResponse>("/api/call/turn", body);
    if (!ok || !data) {
      const msg = `call/turn ${status}: ${errorText.slice(0, 500)}`;
      setLastError(msg);
      appendLog(msg);
      setBusy(false);
      return;
    }
    setLastTurn(data);
    if (isFinal) {
      setCommittedCallerLines((prev) => [...prev, text]);
    }
    appendLog(
      `call/turn (${isFinal ? "final" : "partial"}) → say_to_caller: ${(data.say_to_caller ?? "").slice(0, 80)}…`
    );
    setBusy(false);
  };

  const handleTriagePreview = async () => {
    const text = utterance.trim();
    if (!text) {
      setLastError("Enter caller text.");
      return;
    }
    const incident = lastTurn?.incident ?? lastStart?.incident;
    const call_session = lastTurn?.call_session ?? lastStart?.call_session;
    if (!incident || !call_session) {
      setLastError("Start a call first.");
      return;
    }
    setBusy(true);
    setLastError(null);
    const body = buildVoiceSimTriagePreviewBody({
      incident,
      call_session,
      latest_transcript: text,
      transcript_history: committedCallerLines,
      mode,
    });
    const { ok, status, data, errorText } = await postJson<VoiceSimTriagePreviewResponseBody>(
      "/api/dev/triage-preview",
      body
    );
    if (!ok || !data) {
      const msg = `dev/triage-preview ${status}: ${errorText.slice(0, 500)}`;
      setLastError(msg);
      appendLog(msg);
      setBusy(false);
      return;
    }
    setLastTriagePreview(data);
    appendLog(
      `triage-preview → say_to_caller: ${(data.triage.say_to_caller ?? "").slice(0, 80)}…`
    );
    setBusy(false);
  };

  const handleEndCall = async () => {
    if (!incidentId || !sessionId) {
      setLastError("Start a call first.");
      return;
    }
    setBusy(true);
    setLastError(null);
    const body: CallEndRequest = {
      incident_id: incidentId,
      call_session_id: sessionId,
      reason: "completed",
    };
    const { ok, status, errorText } = await postJson<unknown>("/api/call/end", body);
    if (!ok) {
      const msg = `call/end ${status}: ${errorText.slice(0, 500)}`;
      setLastError(msg);
      appendLog(msg);
      setBusy(false);
      return;
    }
    appendLog("call/end → session closed");
    setSessionId("");
    setBusy(false);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 text-zinc-900 dark:text-zinc-50">
      <div
        className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        role="status"
        aria-live="polite"
      >
        {persistence.checked ? (
          persistence.uses_supabase ? (
            <p>
              <strong className="font-medium">Persistence:</strong> service role is configured —{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">/api/call/*</code>{" "}
              writes to Supabase. Check tables{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">incidents</code>,{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">call_sessions</code>,{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">transcript_events</code>,{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">audit_logs</code>.
            </p>
          ) : (
            <p className="text-amber-800 dark:text-amber-200">
              <strong className="font-medium">Persistence:</strong> no Supabase service role in env — calls stay in the
              in-memory demo store only. Set{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              and{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
              to write rows you can inspect in the Supabase dashboard.
            </p>
          )
        ) : (
          <p>Checking persistence…</p>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">1. Start call</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="voice-sim-mode" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Mode
            </label>
            <select
              id="voice-sim-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as AppMode)}
              className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              disabled={busy}
            >
              <option value="normal">normal</option>
              <option value="disaster">disaster</option>
              <option value="world_cup">world_cup</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => void handleStartCall()}
            disabled={busy}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            POST /api/call/start
          </button>
        </div>
        {lastStart ? (
          <pre className="mt-3 max-h-48 overflow-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-950">
            {JSON.stringify(
              { incident_id: lastStart.incident_id, call_session_id: lastStart.call_session_id },
              null,
              2
            )}
          </pre>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">2. Caller transcript (simulated ElevenLabs)</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          <strong className="font-medium">Persisted path:</strong>{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">POST /api/call/turn</code> saves the
          transcript, then runs <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">runCallTriageAgent</code>{" "}
          (same stack as prod). Sends{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">source: simulate</code>.
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          <strong className="font-medium">Dry-run:</strong>{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">POST /api/dev/triage-preview</code> calls
          the same agent with your current utterance + prior <em>final</em> transcript lines — no DB writes. Built by{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">buildVoiceSimTriagePreviewBody</code> in{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">lib/simulate/elevenlabs-voice-sim.ts</code>.
        </p>
        <label htmlFor="voice-sim-utterance" className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Utterance text
        </label>
        <textarea
          id="voice-sim-utterance"
          value={utterance}
          onChange={(e) => setUtterance(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          disabled={busy}
          aria-label="Simulated caller transcript text"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {VOICE_SIM_SAMPLE_UTTERANCES.map((sample, idx) => (
            <button
              key={`${idx}-${sample.slice(0, 24)}`}
              type="button"
              onClick={() => setUtterance(sample)}
              disabled={busy}
              className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              aria-label={`Insert sample ${idx + 1}: ${sample}`}
            >
              Sample {idx + 1}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleSendTurn(false)}
            disabled={turnControlsDisabled}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-600"
          >
            Partial turn (no triage)
          </button>
          <button
            type="button"
            onClick={() => void handleSendTurn(true)}
            disabled={turnControlsDisabled}
            className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Final turn (run triage)
          </button>
          <button
            type="button"
            onClick={() => void handleTriagePreview()}
            disabled={triagePreviewDisabled}
            className="rounded-md border border-violet-400 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 disabled:opacity-50 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100"
            aria-label="Run call triage agent preview without saving to database"
          >
            Triage preview (runCallTriageAgent, no save)
          </button>
        </div>
        {lastTurn ? (
          <pre className="mt-3 max-h-56 overflow-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-950">
            {JSON.stringify(
              {
                say_to_caller: lastTurn.say_to_caller,
                incident: { id: lastTurn.incident.id, status: lastTurn.incident.status, urgency: lastTurn.incident.urgency },
                transcript_event: { id: lastTurn.transcript_event.id, is_final: lastTurn.transcript_event.is_final },
              },
              null,
              2
            )}
          </pre>
        ) : null}
        {lastTurn?.triage_trace ? (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                Tool loop trace ({lastTurn.triage_trace.passes}{" "}
                {lastTurn.triage_trace.passes === 1 ? "pass" : "passes"})
              </h3>
              <span
                className={
                  lastTurn.triage_trace.pass1_provider === "gemma"
                    ? "rounded-full border border-emerald-400 bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-100"
                    : "rounded-full border border-zinc-400 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                }
                title={`requested: ${lastTurn.triage_trace.requested_provider}`}
              >
                pass1: {lastTurn.triage_trace.pass1_provider}
              </span>
              {lastTurn.triage_trace.pass2_provider ? (
                <span
                  className={
                    lastTurn.triage_trace.pass2_provider === "gemma"
                      ? "rounded-full border border-emerald-400 bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-100"
                      : "rounded-full border border-zinc-400 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                  }
                >
                  pass2: {lastTurn.triage_trace.pass2_provider}
                </span>
              ) : null}
              {lastTurn.triage_trace.requested_provider !==
              lastTurn.triage_trace.pass1_provider ? (
                <span className="rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100">
                  fellback from {lastTurn.triage_trace.requested_provider}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Captured by <code className="text-[11px]">repositoryCallTurn</code>{" "}
              when the agent emits <code className="text-[11px]">tool_requests</code>.
              Try <code className="text-[11px]">demo geocode at BMO Field</code> for a
              guaranteed two-pass run.
            </p>
            {lastTurn.triage_trace.pass1_provider_error ? (
              <p
                className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
                role="alert"
              >
                Pass-1 provider error:{" "}
                {lastTurn.triage_trace.pass1_provider_error}
              </p>
            ) : null}
            {lastTurn.triage_trace.pass2_provider_error ? (
              <p
                className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
                role="alert"
              >
                Pass-2 provider error:{" "}
                {lastTurn.triage_trace.pass2_provider_error}
              </p>
            ) : null}
            {lastTurn.triage_trace.tool_results.length === 0 ? (
              <p className="mt-2 text-xs italic text-zinc-500 dark:text-zinc-500">
                Single-pass turn — agent did not request any tools.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                {lastTurn.triage_trace.tool_results.map((r) => (
                  <li
                    key={r.tool_request_id}
                    className="rounded border border-emerald-200 bg-emerald-50/70 px-2 py-1 dark:border-emerald-900 dark:bg-emerald-950/40"
                  >
                    {summarizeToolResult(r)}
                  </li>
                ))}
              </ul>
            )}
            {lastTurn.triage_trace.second_pass_error ? (
              <p
                className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
                role="alert"
              >
                Second-pass error: {lastTurn.triage_trace.second_pass_error}
              </p>
            ) : null}
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-emerald-800 dark:text-emerald-300">
                Raw triage_trace JSON
              </summary>
              <pre className="mt-1 max-h-64 overflow-auto rounded border border-emerald-200 bg-emerald-50/60 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/40">
                {JSON.stringify(lastTurn.triage_trace, null, 2)}
              </pre>
            </details>
          </div>
        ) : null}
        {lastTriagePreview ? (
          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-violet-800 dark:text-violet-300">
              Last dry-run triage (<code className="text-[11px]">/api/dev/triage-preview</code>)
            </h3>
            <pre className="mt-1 max-h-64 overflow-auto rounded border border-violet-200 bg-violet-50/80 p-3 text-xs dark:border-violet-900 dark:bg-violet-950/50">
              {JSON.stringify(lastTriagePreview.triage, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">3. End call</h2>
        <button
          type="button"
          onClick={() => void handleEndCall()}
          disabled={endCallDisabled}
          className="mt-2 rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-600"
        >
          POST /api/call/end (reason: completed)
        </button>
      </div>

      {lastError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100" role="alert">
          {lastError}
        </p>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Activity log</h3>
        <ul className="mt-2 max-h-40 overflow-auto font-mono text-xs text-zinc-600 dark:text-zinc-400">
          {log.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-500">
        IDs for manual API tools: incident_id{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">{incidentId || "—"}</code>, call_session_id{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">{sessionId || "—"}</code>
      </p>
    </div>
  );
};
