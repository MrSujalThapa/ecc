import { afterEach, describe, expect, it, vi } from "vitest";
import { dashboardFallbackIncidents } from "@/lib/mock/dashboardFallbackData";
import { apiIncidentDataSource } from "./apiIncidentDataSource";

describe("apiIncidentDataSource", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns an honest empty state when the incident API succeeds with no incidents", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ incidents: [] }),
      }),
    );

    const result = await apiIncidentDataSource.getInitialIncidents();

    expect(result).toEqual({
      incidents: [],
      usingFallback: false,
      state: "ready",
      message: "No active incidents in the current incident source.",
    });
  });

  it("keeps static fallback for true API failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
    );

    const result = await apiIncidentDataSource.refreshIncidents();

    expect(result.incidents).toEqual(dashboardFallbackIncidents);
    expect(result.usingFallback).toBe(true);
    expect(result.state).toBe("error");
    expect(result.message).toContain("Incident API returned 503");
  });
});
