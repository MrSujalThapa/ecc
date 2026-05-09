import type { Incident } from "@/lib/types";
import { dashboardFallbackIncidents } from "@/lib/mock/dashboardFallbackData";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import type { IncidentDataSource, IncidentFeedResult } from "./incidentDataSource";
import { apiIncidentDataSource } from "./apiIncidentDataSource";

const MAX_INCIDENTS = 200;

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

const asFeedResult = (
  incidents: Incident[],
  usingFallback: boolean,
  state: IncidentFeedResult["state"],
  message: string | null,
): IncidentFeedResult => ({
  incidents,
  usingFallback,
  state,
  message,
});

async function fetchSupabaseIncidents(): Promise<IncidentFeedResult> {
  if (!isSupabaseIncidentSourceAvailable()) {
    return apiIncidentDataSource.getInitialIncidents();
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("incidents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(MAX_INCIDENTS);

    if (error) {
      throw new Error(error.message);
    }

    const incidents = normalizeIncidents((data ?? []) as unknown as Incident[]);

    if (incidents.length === 0) {
      return asFeedResult(
        dashboardFallbackIncidents,
        true,
        "ready",
        "Supabase returned no incidents, so schema-compatible demo data is shown.",
      );
    }

    return asFeedResult(incidents, false, "ready", null);
  } catch (error) {
    const api = await apiIncidentDataSource.getInitialIncidents();
    return asFeedResult(
      api.incidents,
      api.usingFallback,
      "error",
      error instanceof Error
        ? `Realtime unavailable — using API refresh because ${error.message}.`
        : "Realtime unavailable — using API refresh.",
    );
  }
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

      let current: Incident[] = [];

      const applyChange = (next: Incident[]) => {
        current = normalizeIncidents(next);
        onChange(current);
      };

      void (async () => {
        try {
          const { data, error } = await supabase
            .from("incidents")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(MAX_INCIDENTS);

          if (error) {
            throw new Error(error.message);
          }

          const rows = (data ?? []) as unknown as Incident[];
          // Match `fetchSupabaseIncidents`: empty table uses schema-compatible demo rows.
          applyChange(
            rows.length === 0 ? [...dashboardFallbackIncidents] : rows,
          );
        } catch (err) {
          const error =
            err instanceof Error ? err : new Error("Realtime bootstrap failed");
          options?.onStatusChange?.("error");
          onError?.(error);
        }
      })();

      const channel = supabase
        .channel("dashboard-incidents-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "incidents" },
          (payload) => {
            try {
              const eventType = payload.eventType;
              const row = (payload.new ?? payload.old) as unknown as Incident;
              const rowId = canonicalIncidentId(row?.id);
              if (!rowId) {
                return;
              }

              if (eventType === "DELETE") {
                applyChange(
                  current.filter((i) => canonicalIncidentId(i.id) !== rowId),
                );
                return;
              }

              const incoming = payload.new as unknown as Incident;
              applyChange([
                ...current.filter((i) => canonicalIncidentId(i.id) !== rowId),
                { ...incoming, id: rowId },
              ]);
            } catch (err) {
              const error =
                err instanceof Error ? err : new Error("Realtime update failed");
              options?.onStatusChange?.("error");
              onError?.(error);
            }
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
