export type SimulationLifecycleEvent = {
  phase: "start" | "success" | "error";
  kind: "disaster" | "world_cup" | "realistic_geocode" | "clear";
  resetExisting: boolean;
};

export type SimulationResetState = {
  incidents: [];
  usingFallback: false;
  loadState: "loading" | "ready";
  loadMessage: string | null;
  clearSelection: true;
};

export const getSimulationResetState = (
  event: SimulationLifecycleEvent,
): SimulationResetState | null => {
  if (event.phase === "start" && event.resetExisting) {
    return {
      incidents: [],
      usingFallback: false,
      loadState: "loading",
      loadMessage:
        event.kind === "clear"
          ? "Clearing incidents from the active source..."
          : event.kind === "realistic_geocode"
            ? "Running realistic runtime geocode simulation..."
          : "Resetting incidents before simulation...",
      clearSelection: true,
    };
  }

  if (event.phase === "success" && event.kind === "clear") {
    return {
      incidents: [],
      usingFallback: false,
      loadState: "ready",
      loadMessage: "No active incidents in the current incident source.",
      clearSelection: true,
    };
  }

  return null;
};
