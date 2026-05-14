import { describe, expect, it } from "vitest";
import type { Incident } from "@/lib/types";
import { deriveSurgeClusters, getDisplaySurgeClusters } from "./clustering";

const buildIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: "incident-1",
  public_id: "INC-1",
  created_at: "2026-05-14T12:00:00.000Z",
  updated_at: "2026-05-14T12:00:00.000Z",
  mode: "disaster",
  urgency: "urgent",
  incident_type: "medical",
  status: "active_call",
  operator_required: null,
  assigned_operator: null,
  control_state: "ai_leading",
  ai_active: true,
  location_status: "confirmed_by_ai",
  location_confidence: 0.7,
  location: "Downtown",
  coordinates: { lat: 43.65, lng: -79.38 },
  summary: null,
  collected_fields: {},
  missing_fields: [],
  custom_fields: [],
  recommended_action: null,
  priority_score: null,
  cluster_id: null,
  transcript_url: null,
  audio_url: null,
  last_updated_by: "system",
  ...overrides,
});

describe("deriveSurgeClusters", () => {
  it("preserves backend geoops source and persisted cluster ids", () => {
    const clusters = deriveSurgeClusters([
      buildIncident({
        id: "incident-a",
        cluster_id: "DISASTER-CORE-01",
        priority_score: 90,
      }),
      buildIncident({
        id: "incident-b",
        cluster_id: "DISASTER-CORE-01",
        coordinates: { lat: 43.651, lng: -79.381 },
        priority_score: 82,
      }),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({
      cluster_id: "DISASTER-CORE-01",
      source: "backend_geoops",
      priority_score: 90,
    });
  });

  it("marks client-derived grid clusters as client fallback", () => {
    const clusters = deriveSurgeClusters([
      buildIncident({
        id: "incident-a",
        cluster_id: null,
        priority_score: 55,
      }),
      buildIncident({
        id: "incident-b",
        cluster_id: null,
        coordinates: { lat: 43.651, lng: -79.381 },
      }),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.cluster_id.startsWith("local-")).toBe(true);
    expect(clusters[0]).toMatchObject({
      source: "client_fallback",
      priority_score: 55,
    });
  });

  it("does not claim backend geoops for fallback mock clusters", () => {
    const clusters = getDisplaySurgeClusters([
      buildIncident({
        id: "incident-a",
        coordinates: null,
      }),
    ]);

    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters.every((cluster) => cluster.source === "client_fallback")).toBe(
      true,
    );
  });

  it("keeps priority score null when no incident scores are available", () => {
    const clusters = deriveSurgeClusters([
      buildIncident({
        id: "incident-a",
        cluster_id: "DISASTER-CORE-02",
        priority_score: null,
      }),
      buildIncident({
        id: "incident-b",
        cluster_id: "DISASTER-CORE-02",
        coordinates: { lat: 43.651, lng: -79.381 },
        priority_score: null,
      }),
    ]);

    expect(clusters[0]?.priority_score).toBeNull();
  });
});
