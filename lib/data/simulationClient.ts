import { postJson, type PostJsonResult } from "@/lib/http/postJson";
import type {
  SimulateDisasterRequest,
  SimulateDisasterResponse,
  SimulateWorldCupRequest,
  SimulateWorldCupResponse,
} from "@/lib/types";

export const REALISTIC_GEOCODE_TEST_TRANSCRIPTS = [
  "There is an emergency at 110 University Ave W, Waterloo, Ontario, Canada. Someone needs help.",
  "Someone is injured at CN Tower, 290 Bremner Blvd, Toronto, ON, Canada.",
] as const;

/** Dashboard / dev UI: typed POST with `{ ok, status, data, errorText }` for banners. */
export const postSimulateDisaster = (
  body: SimulateDisasterRequest,
): Promise<PostJsonResult<SimulateDisasterResponse>> =>
  postJson<SimulateDisasterResponse>("/api/simulate/disaster", body);

export const postSimulateWorldCup = (
  body: SimulateWorldCupRequest,
): Promise<PostJsonResult<SimulateWorldCupResponse>> =>
  postJson<SimulateWorldCupResponse>("/api/simulate/world-cup", body);

export const runRealisticGeocodeSimulation = (): Promise<
  PostJsonResult<SimulateDisasterResponse>
> =>
  postJson<SimulateDisasterResponse>("/api/simulate/disaster", {
    reset_existing: true,
    batch_size: 2,
    simulation_strategy: "realistic",
    transcripts: [...REALISTIC_GEOCODE_TEST_TRANSCRIPTS],
  });

async function postSimulation<TResponse, TRequest>(
  path: string,
  body?: TRequest,
): Promise<TResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

export type SimulationClient = {
  simulateDisaster(
    input?: SimulateDisasterRequest,
  ): Promise<SimulateDisasterResponse>;
  simulateWorldCup(
    input?: SimulateWorldCupRequest,
  ): Promise<SimulateWorldCupResponse>;
  runRealisticGeocodeSimulation(): Promise<SimulateDisasterResponse>;
};

export const simulationClient: SimulationClient = {
  simulateDisaster(input) {
    return postSimulation<SimulateDisasterResponse, SimulateDisasterRequest>(
      "/api/simulate/disaster",
      input,
    );
  },

  simulateWorldCup(input) {
    return postSimulation<SimulateWorldCupResponse, SimulateWorldCupRequest>(
      "/api/simulate/world-cup",
      input,
    );
  },

  runRealisticGeocodeSimulation() {
    return postSimulation<SimulateDisasterResponse, SimulateDisasterRequest>(
      "/api/simulate/disaster",
      {
        reset_existing: true,
        batch_size: 2,
        simulation_strategy: "realistic",
        transcripts: [...REALISTIC_GEOCODE_TEST_TRANSCRIPTS],
      },
    );
  },
};
