import { describe, expect, it, vi, afterEach } from "vitest";
import {
  postSimulateDisaster,
  runRealisticGeocodeSimulation,
  REALISTIC_GEOCODE_TEST_TRANSCRIPTS,
} from "./simulationClient";

describe("simulationClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("seeded disaster simulation does not include realistic strategy by default", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            created_incidents: [],
            created_call_sessions: [],
            mode: "disaster",
          }),
        json: async () => ({
          created_incidents: [],
          created_call_sessions: [],
          mode: "disaster",
        }),
      } as Response);

    await postSimulateDisaster({
      batch_size: 50,
      reset_existing: true,
    });

    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("/api/simulate/disaster");
    expect(request?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      batch_size: 50,
      reset_existing: true,
    });
  });

  it("realistic geocode test sends realistic strategy and both transcripts", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            created_incidents: [],
            created_call_sessions: [],
            mode: "disaster",
          }),
        json: async () => ({
          created_incidents: [],
          created_call_sessions: [],
          mode: "disaster",
        }),
      } as Response);

    await runRealisticGeocodeSimulation();

    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("/api/simulate/disaster");
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      reset_existing: true,
      batch_size: 2,
      simulation_strategy: "realistic",
      transcripts: [...REALISTIC_GEOCODE_TEST_TRANSCRIPTS],
    });
  });
});
