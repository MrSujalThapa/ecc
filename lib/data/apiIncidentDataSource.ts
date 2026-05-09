import type { Incident } from "@/lib/types";
import { dashboardFallbackIncidents } from "@/lib/mock/dashboardFallbackData";
import type { IncidentDataSource, IncidentFeedResult } from "./incidentDataSource";

type DevIncidentsResponse = {
  incidents?: Incident[];
};

async function fetchIncidentFeed(): Promise<IncidentFeedResult> {
  try {
    const response = await fetch("/api/dev/incidents?limit=100", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Incident API returned ${response.status}`);
    }

    const payload = (await response.json()) as DevIncidentsResponse;
    const apiIncidents = payload.incidents ?? [];

    if (apiIncidents.length === 0) {
      return {
        incidents: dashboardFallbackIncidents,
        usingFallback: true,
        state: "ready",
        message:
          "API returned no incidents, so schema-compatible demo data is shown.",
      };
    }

    return {
      incidents: apiIncidents,
      usingFallback: false,
      state: "ready",
      message: null,
    };
  } catch (error) {
    return {
      incidents: dashboardFallbackIncidents,
      usingFallback: true,
      state: "error",
      message:
        error instanceof Error
          ? `Using fallback incidents because ${error.message}.`
          : "Using fallback incidents because the API request failed.",
    };
  }
}

export const apiIncidentDataSource: IncidentDataSource = {
  getInitialIncidents: fetchIncidentFeed,
  refreshIncidents: fetchIncidentFeed,
};
