import { postJson, type PostJsonResult } from "@/lib/http/postJson";
import type {
  SimulateDisasterRequest,
  SimulateDisasterResponse,
  SimulateWorldCupRequest,
  SimulateWorldCupResponse,
} from "@/lib/types";

/** Dashboard / dev UI: typed POST with `{ ok, status, data, errorText }` for banners. */
export const postSimulateDisaster = (
  body: SimulateDisasterRequest,
): Promise<PostJsonResult<SimulateDisasterResponse>> =>
  postJson<SimulateDisasterResponse>("/api/simulate/disaster", body);

export const postSimulateWorldCup = (
  body: SimulateWorldCupRequest,
): Promise<PostJsonResult<SimulateWorldCupResponse>> =>
  postJson<SimulateWorldCupResponse>("/api/simulate/world-cup", body);

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
};
