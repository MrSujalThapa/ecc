import { describe, expect, it } from "vitest";
import {
  getSimulationResetState,
  type SimulationLifecycleEvent,
} from "./simulationLifecycleState";

describe("getSimulationResetState", () => {
  it("clears incident state at the start of a reset simulation", () => {
    const event: SimulationLifecycleEvent = {
      phase: "start",
      kind: "disaster",
      resetExisting: true,
    };

    expect(getSimulationResetState(event)).toEqual({
      incidents: [],
      usingFallback: false,
      loadState: "loading",
      loadMessage: "Resetting incidents before simulation...",
      clearSelection: true,
    });
  });

  it("keeps non-reset simulations from clearing local incidents up front", () => {
    const event: SimulationLifecycleEvent = {
      phase: "start",
      kind: "world_cup",
      resetExisting: false,
    };

    expect(getSimulationResetState(event)).toBeNull();
  });

  it("keeps the dashboard empty after an explicit clear succeeds", () => {
    const event: SimulationLifecycleEvent = {
      phase: "success",
      kind: "clear",
      resetExisting: true,
    };

    expect(getSimulationResetState(event)).toEqual({
      incidents: [],
      usingFallback: false,
      loadState: "ready",
      loadMessage: "No active incidents in the current incident source.",
      clearSelection: true,
    });
  });
});
