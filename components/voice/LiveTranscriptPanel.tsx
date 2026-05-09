"use client";

import type { Incident } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import type { TranscriptEvent } from "@/lib/types";
import {
  fetchTranscriptEventsForIncident,
  isSupabaseTranscriptSourceAvailable,
  subscribeTranscriptEventsForIncident,
} from "@/lib/data/supabaseTranscriptDataSource";

type LiveTranscriptPanelProps = {
  incident: Incident;
};

export function LiveTranscriptPanel({ incident }: LiveTranscriptPanelProps) {
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

  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
        Transcript / Audio
      </h3>
      <div className="space-y-3 rounded-2xl border border-white/10 bg-[#040f16] p-4 text-sm text-slate-300">
        {canUseRealtime ? (
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

        {incident.transcript_url ? (
          <a
            href={incident.transcript_url}
            target="_blank"
            rel="noreferrer"
            className="block text-cyan-200 underline-offset-4 hover:underline"
          >
            Open transcript record
          </a>
        ) : (
          <p>
            Live transcript is not available yet. This drawer will show a
            transcript link once the backend provides one.
          </p>
        )}

        {incident.audio_url ? (
          <a
            href={incident.audio_url}
            target="_blank"
            rel="noreferrer"
            className="block text-cyan-200 underline-offset-4 hover:underline"
          >
            Open audio recording
          </a>
        ) : (
          <p className="text-slate-500">No audio recording is attached.</p>
        )}
      </div>
    </section>
  );
}
