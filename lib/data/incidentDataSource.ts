import type { Incident } from "@/lib/types";

export type IncidentFeedState = "ready" | "error";

export type IncidentFeedResult = {
  incidents: Incident[];
  usingFallback: boolean;
  state: IncidentFeedState;
  message: string | null;
};

export type IncidentDataSource = {
  getInitialIncidents(): Promise<IncidentFeedResult>;
  refreshIncidents(): Promise<IncidentFeedResult>;
  subscribeToIncidents?: (
    onChange: (incidents: Incident[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
};
