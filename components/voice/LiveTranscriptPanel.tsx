"use client";

import type { Incident } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TranscriptEvent } from "@/lib/types";
import {
  fetchTranscriptEventsForIncident,
  isSupabaseTranscriptSourceAvailable,
  subscribeTranscriptEventsForIncident,
} from "@/lib/data/supabaseTranscriptDataSource";
import { useDashboardPersona } from "@/components/dashboard/DashboardPersonaContext";

type LiveTranscriptPanelProps = {
  incident: Incident;
};

/** Plain-text export: fixed-width headers, chronological turns, machine-readable timestamps. */
const buildTranscriptTxt = (
  incident: Incident,
  orderedEvents: TranscriptEvent[],
): string => {
  const exportedAt = new Date().toISOString();
  const lines: string[] = [
    "=".repeat(78),
    "INCIDENT TRANSCRIPT EXPORT",
    "=".repeat(78),
    "",
    "INCIDENT",
    "-".repeat(78),
    `Incident ID:     ${incident.id}`,
    `Public ID:       ${incident.public_id ?? "(none)"}`,
    `Mode:            ${incident.mode}`,
    `Status:          ${incident.status}`,
    `Urgency:         ${incident.urgency}`,
    `Exported (UTC): ${exportedAt}`,
    "",
    "=".repeat(78),
    `TURNS (${orderedEvents.length} event${orderedEvents.length === 1 ? "" : "s"}, chronological)`,
    "=".repeat(78),
    "",
  ];

  orderedEvents.forEach((ev, index) => {
    const n = String(index + 1).padStart(3, "0");
    const speaker = ev.speaker.replaceAll("_", " ").toUpperCase();
    const final = ev.is_final ? "final" : "partial";
    const lang = ev.language?.trim() ? ev.language.trim() : "—";
    lines.push(
      `[${n}] ${ev.created_at}`,
      `      SPEAKER: ${speaker}  |  is_final: ${final}  |  language: ${lang}`,
      "-".repeat(78),
      ev.text.trim() || "(empty)",
    );
    if (ev.translated_text?.trim()) {
      lines.push("", "      — Translation —", ev.translated_text.trim());
    }
    lines.push("");
  });

  lines.push(
    "=".repeat(78),
    `END OF TRANSCRIPT (${orderedEvents.length} turn${orderedEvents.length === 1 ? "" : "s"})`,
    "=".repeat(78),
    "",
  );

  return lines.join("\n");
};

const triggerTxtDownload = (filename: string, contents: string): void => {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
};

export function LiveTranscriptPanel({ incident }: LiveTranscriptPanelProps) {
  const { visibility } = useDashboardPersona();
  const [events, setEvents] = useState<TranscriptEvent[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const canUseRealtime = useMemo(
    () => isSupabaseTranscriptSourceAvailable(),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const run = async () => {
      setEvents([]);
      setMessage(null);

      if (!canUseRealtime) {
        setState("error");
        setMessage("Live transcript not available yet.");
        return;
      }

      setState("loading");

      const result = await fetchTranscriptEventsForIncident(incident.id);
      if (cancelled) return;

      setEvents(result.events);
      setState(result.state === "ready" ? "ready" : "error");
      setMessage(result.message);

      unsubscribe = subscribeTranscriptEventsForIncident(
        incident.id,
        (event) => {
          if (cancelled) return;
          setEvents((current) => {
            const filtered = current.filter((row) => row.id !== event.id);
            const next = [...filtered, event];
            next.sort(
              (a, b) =>
                (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0),
            );
            return next.slice(-120);
          });
        },
        (error) => {
          if (cancelled) return;
          setState("error");
          setMessage(
            error.message
              ? `Live transcript not available yet (${error.message}).`
              : "Live transcript not available yet.",
          );
        },
      );
    };

    void run();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [canUseRealtime, incident.id]);

  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0),
      ),
    [events],
  );

  const handleExportTranscript = useCallback(() => {
    if (sortedEvents.length === 0) return;
    const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
    const shortId = incident.id.replaceAll("-", "").slice(0, 12);
    const filename = `transcript-${shortId}-${stamp}.txt`;
    const body = buildTranscriptTxt(incident, sortedEvents);
    triggerTxtDownload(filename, body);
  }, [incident, sortedEvents]);

  const exportDisabled = sortedEvents.length === 0 || state === "loading";

  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
        Transcript
      </h3>
      <div className="space-y-3 rounded-2xl border border-white/10 bg-[#040f16] p-4 text-sm text-slate-300">
        {canUseRealtime && visibility.showTranscriptInfrastructure ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Live transcript
            </p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                state === "ready"
                  ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                  : state === "loading"
                    ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100"
                    : "border-slate-600/30 bg-[#000814]/30 text-slate-300"
              }`}
              title="Supabase transcript_events subscription (if configured)"
            >
              {state === "ready"
                ? "Connected"
                : state === "loading"
                  ? "Connecting"
                  : "Unavailable"}
            </span>
          </div>
        ) : null}

        {events.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-white/10 bg-[#000814]/40 p-3">
            {events.slice(-8).map((event) => (
              <div
                key={event.id}
                className={`space-y-1 rounded-xl border px-3 py-2 ${
                  event.speaker === "caller"
                    ? "border-slate-700/40 bg-[#000814]/30"
                    : event.speaker === "ai"
                      ? "border-cyan-400/15 bg-cyan-500/10"
                      : "border-emerald-400/15 bg-emerald-500/10"
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
                  <span className="font-semibold uppercase tracking-wide">
                    {event.speaker.replaceAll("_", " ")}
                  </span>
                  <span>{new Date(event.created_at).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm leading-5 text-slate-100">{event.text}</p>
                {event.translated_text ? (
                  <p className="text-xs text-slate-400">
                    {event.translated_text}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : message ? (
          <p>{message}</p>
        ) : (
          <p className="text-slate-500">
            No transcript events yet for this incident.
          </p>
        )}

        <div className="border-t border-white/10 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Export transcript
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Download everything loaded for this incident as a structured plain-text file (UTF-8).
          </p>
          <button
            type="button"
            onClick={handleExportTranscript}
            disabled={exportDisabled}
            className="mt-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Download transcript as a text file"
          >
            Download .txt
          </button>
          {exportDisabled && events.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Load at least one transcript line to enable export.
            </p>
          ) : null}

          {visibility.showTranscriptDeveloperTools ? (
            <>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Optional backend link
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Separate field for a vendor-hosted or archived transcript URL (not required for export
                above).
              </p>
              {incident.transcript_url ? (
                <a
                  href={incident.transcript_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block text-cyan-200 underline-offset-4 hover:underline"
                >
                  Open transcript record
                </a>
              ) : (
                <p className="mt-2 text-xs text-slate-500">None on this incident.</p>
              )}
            </>
          ) : null}
        </div>

        {/*
         * --------------------------------------------------------------------------
         * PENDING CHANGE: Audio recording block (incidents.audio_url)
         * Hidden until post-call recording is implemented. Product notes:
         * docs/project_details.md — "Audio playback strategy" (MVP: defer),
         * section 22.5 "Audio playback".
         * --------------------------------------------------------------------------
         *
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Audio recording
          </p>
          {incident.audio_url ? (
            <a
              href={incident.audio_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-cyan-200 underline-offset-4 hover:underline"
            >
              Open audio recording
            </a>
          ) : (
            <p className="mt-2 text-xs text-slate-500">No saved call recording link on this incident.</p>
          )}
        </div>
        */}
      </div>
    </section>
  );
}
