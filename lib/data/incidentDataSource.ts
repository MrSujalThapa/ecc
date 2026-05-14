import type { Incident } from "@/lib/types";

export type IncidentFeedState = "ready" | "error";

export type IncidentFeedResult = {
  incidents: Incident[];
  usingFallback: boolean;
  state: IncidentFeedState;
  message: string | null;
};

export type IncidentDataSource = {
  /** Required bootstrap path for initial dashboard hydration. */
  getInitialIncidents(): Promise<IncidentFeedResult>;
  refreshIncidents(): Promise<IncidentFeedResult>;
  /** Optional realtime enhancement; not a guarantee that bootstrap data has loaded. */
  subscribeToIncidents?: (
    onChange: (incidents: Incident[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
};
