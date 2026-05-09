/**
 * Dashboard incident feed: HTTP (same shapes as contracts) + optional Supabase Realtime.
 * Import only from Client Components — Realtime uses the browser Supabase client.
 */

import { createClient } from "@/lib/supabase/client";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import type { CallSession, Incident } from "@/lib/types/domain";

type DevIncidentsResponse = {
  incidents?: Incident[];
};

type DevCallSessionsResponse = {
  call_sessions?: CallSession[];
};

export const isDashboardRealtimeAvailable = (): boolean =>
  Boolean(getSupabaseUrl() && getSupabaseAnonKey());

/**
 * Refetch incidents from the same dev list endpoint the dashboard already uses.
 */
export const fetchDashboardIncidents = async (limit = 100): Promise<Incident[]> => {
  const res = await fetch(`/api/dev/incidents?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GET /api/dev/incidents failed: ${res.status}`);
  }
  const payload = (await res.json()) as DevIncidentsResponse;
  return payload.incidents ?? [];
};

export const fetchCallSessionsForIncident = async (
  incidentId: string
): Promise<CallSession[]> => {
  const res = await fetch(
    `/api/dev/call-sessions?incident_id=${encodeURIComponent(incidentId)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`GET /api/dev/call-sessions failed: ${res.status}`);
  }
  const payload = (await res.json()) as DevCallSessionsResponse;
  return payload.call_sessions ?? [];
};

/**
 * Subscribe to `public.incidents` changes; caller should refetch (e.g. `fetchDashboardIncidents`).
 * Returns an unsubscribe function. Throws if browser env keys are missing — call `isDashboardRealtimeAvailable()` first.
 */
export const subscribeIncidentsRealtime = (onInvalidate: () => void): (() => void) => {
  const supabase = createClient();
  const channel = supabase
    .channel("dashboard-incidents")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "incidents" },
      () => {
        onInvalidate();
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
};
