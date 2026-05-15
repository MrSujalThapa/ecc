import type { Incident } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import type { IncidentDataSource, IncidentFeedResult } from "./incidentDataSource";
import { apiIncidentDataSource } from "./apiIncidentDataSource";

/** Stable key for dedupe + realtime merge (avoids duplicate rows when UUID casing/types differ). */
const canonicalIncidentId = (id: unknown): string | null => {
  if (id === null || id === undefined) {
    return null;
  }
  const s = String(id).trim();
  return s.length === 0 ? null : s.toLowerCase();
};

export type SupabaseIncidentSourceStatus =
  | "unavailable"
  | "connected"
  | "error";

export const isSupabaseIncidentSourceAvailable = (): boolean =>
  Boolean(getSupabaseUrl() && getSupabaseAnonKey());

async function fetchSupabaseIncidents(): Promise<IncidentFeedResult> {
  return apiIncidentDataSource.getInitialIncidents();
}

function normalizeIncidents(incidents: Incident[]): Incident[] {
  const map = new Map<string, Incident>();
  incidents.forEach((incident) => {
    const id = canonicalIncidentId(incident?.id);
    if (!id) {
      return;
    }
    map.set(id, { ...incident, id });
  });
  return Array.from(map.values()).sort((a, b) => {
    const aTime = Date.parse(a.created_at ?? "") || 0;
    const bTime = Date.parse(b.created_at ?? "") || 0;
    return bTime - aTime;
  });
}

export function createSupabaseIncidentDataSource(options?: {
  onStatusChange?: (status: SupabaseIncidentSourceStatus) => void;
}): IncidentDataSource {
  const refreshFromApi = async (
    onChange: (incidents: Incident[]) => void,
    onError?: (error: Error) => void,
  ): Promise<void> => {
    try {
      const result = await apiIncidentDataSource.refreshIncidents();
      onChange(normalizeIncidents(result.incidents));
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Incident refresh failed");
      options?.onStatusChange?.("error");
      onError?.(error);
    }
  };

  return {
    getInitialIncidents: fetchSupabaseIncidents,
    refreshIncidents: fetchSupabaseIncidents,
    subscribeToIncidents: (onChange, onError) => {
      if (!isSupabaseIncidentSourceAvailable()) {
        options?.onStatusChange?.("unavailable");
        return () => {};
      }

      const supabase = createClient();
      options?.onStatusChange?.("connected");

      void (async () => {
        await refreshFromApi(onChange, onError);
      })();

      const channel = supabase
        .channel("dashboard-incidents-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "incidents" },
          () => {
            void refreshFromApi(onChange, onError);
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            options?.onStatusChange?.("connected");
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            options?.onStatusChange?.("error");
          }
        });

      return () => {
        options?.onStatusChange?.("unavailable");
        void supabase.removeChannel(channel);
      };
    },
  };
}
