import { createClient } from "@/lib/supabase/client";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import type { TranscriptEvent } from "@/lib/types";

const MAX_TRANSCRIPT_EVENTS = 120;

export type TranscriptFeedResult = {
  events: TranscriptEvent[];
  state: "ready" | "error";
  message: string | null;
};

export const isSupabaseTranscriptSourceAvailable = (): boolean =>
  Boolean(getSupabaseUrl() && getSupabaseAnonKey());

export async function fetchTranscriptEventsForIncident(
  incidentId: string,
  limit = MAX_TRANSCRIPT_EVENTS,
): Promise<TranscriptFeedResult> {
  if (!isSupabaseTranscriptSourceAvailable()) {
    return {
      events: [],
      state: "error",
      message: "Live transcript not available yet.",
    };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("transcript_events")
      .select("*")
      .eq("incident_id", incidentId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    return { events: (data ?? []) as unknown as TranscriptEvent[], state: "ready", message: null };
  } catch (error) {
    return {
      events: [],
      state: "error",
      message:
        error instanceof Error
          ? `Live transcript not available yet (${error.message}).`
          : "Live transcript not available yet.",
    };
  }
}

export function subscribeTranscriptEventsForIncident(
  incidentId: string,
  onChange: (event: TranscriptEvent) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!isSupabaseTranscriptSourceAvailable()) {
    return () => {};
  }

  const supabase = createClient();
  const channel = supabase
    .channel(`dashboard-transcript-${incidentId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "transcript_events",
        filter: `incident_id=eq.${incidentId}`,
      },
      (payload) => {
        try {
          const row = (payload.new ?? payload.old) as unknown as TranscriptEvent;
          if (!row?.id) return;
          onChange(row);
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error("Transcript update failed"));
        }
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

