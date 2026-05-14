import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Incident } from "@/lib/types";
import { dashboardFallbackIncidents } from "@/lib/mock/dashboardFallbackData";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

const { getSupabaseUrl, getSupabaseAnonKey } = vi.hoisted(() => ({
  getSupabaseUrl: vi.fn(),
  getSupabaseAnonKey: vi.fn(),
}));

const { apiIncidentDataSource } = vi.hoisted(() => ({
  apiIncidentDataSource: {
    getInitialIncidents: vi.fn(),
    refreshIncidents: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient,
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseUrl,
  getSupabaseAnonKey,
}));

vi.mock("@/lib/data/apiIncidentDataSource", () => ({
  apiIncidentDataSource,
}));

import {
  createSupabaseIncidentDataSource,
  isSupabaseIncidentSourceAvailable,
} from "./supabaseIncidentDataSource";

const buildIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: "incident-1",
  public_id: "INC-1",
  created_at: "2026-05-14T12:00:00.000Z",
  updated_at: "2026-05-14T12:00:00.000Z",
  mode: "normal",
  urgency: "unknown",
  incident_type: "unknown",
  status: "active_call",
  operator_required: null,
  assigned_operator: null,
  control_state: "ai_leading",
  ai_active: true,
  location_status: "unknown",
  location_confidence: null,
  location: null,
  coordinates: null,
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

const createSupabaseMock = (rows: Incident[] = [], error: string | null = null) => {
  const limit = vi.fn().mockResolvedValue({
    data: rows,
    error: error ? { message: error } : null,
  });
  const order = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));
  const subscribe = vi.fn();
  const on = vi.fn(() => ({ subscribe }));
  const channel = vi.fn(() => ({ on }));
  const removeChannel = vi.fn();

  return {
    client: { from, channel, removeChannel },
    spies: { from, select, order, limit, channel, on, subscribe, removeChannel },
  };
};

describe("createSupabaseIncidentDataSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseUrl.mockReturnValue("https://example.supabase.co");
    getSupabaseAnonKey.mockReturnValue("anon-key");
    apiIncidentDataSource.getInitialIncidents.mockResolvedValue({
      incidents: [buildIncident({ id: "api-incident" })],
      usingFallback: false,
      state: "ready",
      message: null,
    });
    apiIncidentDataSource.refreshIncidents.mockResolvedValue({
      incidents: [buildIncident({ id: "api-incident" })],
      usingFallback: false,
      state: "ready",
      message: null,
    });
  });

  it("uses API fallback when browser Supabase env is missing", async () => {
    getSupabaseUrl.mockReturnValue(undefined);
    getSupabaseAnonKey.mockReturnValue(undefined);

    expect(isSupabaseIncidentSourceAvailable()).toBe(false);

    const source = createSupabaseIncidentDataSource();
    const result = await source.getInitialIncidents();

    expect(apiIncidentDataSource.getInitialIncidents).toHaveBeenCalledTimes(1);
    expect(result.incidents[0]?.id).toBe("api-incident");
    expect(result.usingFallback).toBe(false);
  });

  it("keeps subscribeToIncidents as a realtime no-op when Supabase env is unavailable", () => {
    getSupabaseUrl.mockReturnValue(undefined);
    getSupabaseAnonKey.mockReturnValue(undefined);
    const onStatusChange = vi.fn();
    const onChange = vi.fn();
    const onError = vi.fn();

    const source = createSupabaseIncidentDataSource({ onStatusChange });
    const unsubscribe = source.subscribeToIncidents?.(onChange, onError);

    expect(onStatusChange).toHaveBeenCalledWith("unavailable");
    expect(onChange).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(typeof unsubscribe).toBe("function");
  });

  it("bootstraps realtime subscription with normalized incidents when configured", async () => {
    const supabase = createSupabaseMock([
      buildIncident({ id: "INCIDENT-2", created_at: "2026-05-14T13:00:00.000Z" }),
      buildIncident({ id: "incident-1", created_at: "2026-05-14T12:00:00.000Z" }),
    ]);
    createClient.mockReturnValue(supabase.client);
    const onStatusChange = vi.fn();
    const onChange = vi.fn();

    const source = createSupabaseIncidentDataSource({ onStatusChange });
    source.subscribeToIncidents?.(onChange, vi.fn());
    await Promise.resolve();
    await Promise.resolve();

    expect(onStatusChange).toHaveBeenCalledWith("connected");
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "incident-2" }),
      expect.objectContaining({ id: "incident-1" }),
    ]);
  });

  it("reports realtime bootstrap errors honestly", async () => {
    const supabase = createSupabaseMock([], "bootstrap_failed");
    createClient.mockReturnValue(supabase.client);
    const onStatusChange = vi.fn();
    const onError = vi.fn();

    const source = createSupabaseIncidentDataSource({ onStatusChange });
    source.subscribeToIncidents?.(vi.fn(), onError);
    await Promise.resolve();
    await Promise.resolve();

    expect(onStatusChange).toHaveBeenCalledWith("error");
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0]?.[0]?.message).toContain("bootstrap_failed");
  });

  it("uses static fallback only when Supabase returns no incidents", async () => {
    const supabase = createSupabaseMock([]);
    createClient.mockReturnValue(supabase.client);

    const source = createSupabaseIncidentDataSource();
    const result = await source.getInitialIncidents();

    expect(result.incidents).toEqual(dashboardFallbackIncidents);
    expect(result.usingFallback).toBe(true);
    expect(result.message).toContain("Supabase returned no incidents");
  });
});
