"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppMode, CallSession, Incident, Responder } from "@/lib/types";
import { ClusterDrawer } from "@/components/incidents/ClusterDrawer";
import { IncidentDrawer } from "@/components/incidents/IncidentDrawer";
import {
  IncidentQueue,
  type IncidentQueueFilters,
} from "@/components/incidents/IncidentQueue";
import { CommandMap } from "@/components/map/CommandMap";
import { TopBar } from "@/components/dashboard/TopBar";
import { DemoControls } from "@/components/dashboard/DemoControls";
import {
  DashboardPersonaProvider,
  useDashboardPersona,
} from "@/components/dashboard/DashboardPersonaContext";
import { apiOperatorActions } from "@/lib/data/apiOperatorActions";
import { respondersClient } from "@/lib/data/respondersClient";
import {
  createSupabaseIncidentDataSource,
  type SupabaseIncidentSourceStatus,
} from "@/lib/data/supabaseIncidentDataSource";
import {
  findSurgeClusterForIncident,
  getDisplaySurgeClusters,
} from "@/lib/map/clustering";
import type {
  IncidentFeedResult,
  IncidentFeedState,
} from "@/lib/data/incidentDataSource";
import {
  fetchCallSessionsForIncident,
} from "@/lib/data/dashboardIncidentFeed";

type LoadState = "loading" | IncidentFeedState;

const applyIncidentFeedResult = (
  result: IncidentFeedResult,
  setIncidents: (incidents: Incident[]) => void,
  setUsingFallback: (usingFallback: boolean) => void,
  setLoadState: (state: LoadState) => void,
  setLoadMessage: (message: string | null) => void,
) => {
  setIncidents(result.incidents);
  setUsingFallback(result.usingFallback);
  setLoadState(result.state);
  setLoadMessage(result.message);
};

const defaultQueueFilters: IncidentQueueFilters = {
  mode: "all",
  urgency: "all",
  status: "all",
  assignedOperator: "all",
};

function IncidentFeedBanner({
  loadMessage,
  loadState,
}: {
  loadMessage: string | null;
  loadState: LoadState;
}) {
  const { visibility } = useDashboardPersona();

  if (!loadMessage) {
    return null;
  }

  if (!visibility.showVerboseIncidentFeedBanner && loadState !== "error") {
    return null;
  }

  return (
    <div
      className={`border-b px-5 py-2 text-sm ${
        loadState === "error"
          ? "border-[#d00000]/35 bg-[#000814]/12 text-[#dbe7f3]"
          : "border-[rgba(112,214,255,0.18)] bg-[#06111f] text-[#8b9bb0]"
      }`}
      role={loadState === "error" ? "alert" : "status"}
    >
      {loadMessage}
    </div>
  );
}

export function DashboardShell() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<
    string | null | undefined
  >(undefined);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [queueFilters, setQueueFilters] =
    useState<IncidentQueueFilters>(defaultQueueFilters);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [realtimeStatus, setRealtimeStatus] =
    useState<SupabaseIncidentSourceStatus>("unavailable");
  const [responders, setResponders] = useState<Responder[]>([]);
  const [responderMessage, setResponderMessage] = useState<string | null>(null);
  const [callSessionsForSelected, setCallSessionsForSelected] = useState<
    CallSession[]
  >([]);
  /** Avoid TopBar hydration mismatch: SSR + first client paint must agree before tying disabled to async loadState. */
  const [clientMounted, setClientMounted] = useState(false);
  const selectionRef = useRef<string | null>(null);

  const incidentDataSource = useMemo(
    () =>
      createSupabaseIncidentDataSource({
        onStatusChange: setRealtimeStatus,
      }),
    [],
  );

  const setMode = useCallback((mode: AppMode | "all") => {
    setQueueFilters((currentFilters) => ({
      ...currentFilters,
      mode,
    }));
  }, []);

  const resetDashboardView = useCallback(() => {
    setSelectedIncidentId(null);
    setSelectedClusterId(null);
    setQueueFilters(defaultQueueFilters);
    setCallSessionsForSelected([]);
  }, []);

  const selectIncident = useCallback((incidentId: string) => {
    setSelectedIncidentId(incidentId);
    setSelectedClusterId(null);
  }, []);

  const selectCluster = useCallback((clusterId: string) => {
    setSelectedClusterId(clusterId);
    setSelectedIncidentId(null);
  }, []);

  const refetchIncidentsQuiet = useCallback(async () => {
    const result = await incidentDataSource.refreshIncidents();
    applyIncidentFeedResult(
      result,
      setIncidents,
      setUsingFallback,
      setLoadState,
      setLoadMessage,
    );
  }, [incidentDataSource]);

  const loadIncidents = useCallback(async () => {
    setLoadState("loading");
    setLoadMessage(null);

    const result = await incidentDataSource.refreshIncidents();
    applyIncidentFeedResult(
      result,
      setIncidents,
      setUsingFallback,
      setLoadState,
      setLoadMessage,
    );
  }, [incidentDataSource]);

  useEffect(() => {
    setClientMounted(true);
  }, []);

  useEffect(() => {
    // When `subscribeToIncidents` exists, that path already bootstraps from Supabase.
    // Running `getInitialIncidents()` in parallel can finish later with a different source
    // (e.g. API / in-memory dev list after a thrown client fetch) and overwrite the live
    // feed, so the queue shows more incidents than rows in `public.incidents`.
    if (incidentDataSource.subscribeToIncidents) {
      return;
    }

    let ignore = false;

    const run = async () => {
      const result = await incidentDataSource.getInitialIncidents();
      if (ignore) {
        return;
      }
      applyIncidentFeedResult(
        result,
        setIncidents,
        setUsingFallback,
        setLoadState,
        setLoadMessage,
      );
    };

    void run();

    return () => {
      ignore = true;
    };
  }, [incidentDataSource]);

  useEffect(() => {
    let ignore = false;

    const run = async () => {
      try {
        const nextResponders = await respondersClient.getResponders();
        if (ignore) {
          return;
        }

        setResponders(nextResponders);
        setResponderMessage(
          nextResponders.length === 0
            ? "Responder feed returned no active units."
            : null,
        );
      } catch (error) {
        if (ignore) {
          return;
        }

        setResponders([]);
        setResponderMessage(
          error instanceof Error
            ? `Responder layer unavailable: ${error.message}`
            : "Responder layer unavailable.",
        );
      }
    };

    void run();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!incidentDataSource.subscribeToIncidents) {
      return;
    }

    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = incidentDataSource.subscribeToIncidents(
        (nextIncidents) => {
          startTransition(() => {
            setIncidents(nextIncidents);
            setUsingFallback(false);
            setLoadState("ready");
            setLoadMessage(null);
          });
        },
        (error) => {
          startTransition(() => {
            setLoadMessage(
              `Realtime unavailable — using API refresh because ${error.message}.`,
            );
            setLoadState("error");
          });
          void (async () => {
            try {
              const result = await incidentDataSource.getInitialIncidents();
              startTransition(() => {
                applyIncidentFeedResult(
                  result,
                  setIncidents,
                  setUsingFallback,
                  setLoadState,
                  setLoadMessage,
                );
              });
            } catch {
              // keep error banner; incidents unchanged
            }
          })();
        },
      );
    } catch (error) {
      startTransition(() => {
        setLoadMessage(
          error instanceof Error
            ? `Realtime unavailable — using API refresh because ${error.message}.`
            : "Realtime unavailable — using API refresh.",
        );
        setLoadState("error");
      });
    }

    return () => {
      unsubscribe?.();
    };
  }, [incidentDataSource]);

  const visibleIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      if (queueFilters.mode !== "all" && incident.mode !== queueFilters.mode) {
        return false;
      }

      if (
        queueFilters.urgency !== "all" &&
        incident.urgency !== queueFilters.urgency
      ) {
        return false;
      }

      if (
        queueFilters.status !== "all" &&
        incident.status !== queueFilters.status
      ) {
        return false;
      }

      if (queueFilters.assignedOperator === "unassigned") {
        return incident.assigned_operator === null;
      }

      if (
        queueFilters.assignedOperator !== "all" &&
        incident.assigned_operator !== queueFilters.assignedOperator
      ) {
        return false;
      }

      return true;
    });
  }, [incidents, queueFilters]);

  const selectedIncident =
    selectedIncidentId === undefined
      ? (visibleIncidents[0] ?? null)
      : selectedIncidentId
        ? (visibleIncidents.find((incident) => incident.id === selectedIncidentId) ??
          null)
        : null;

  const effectiveSelectedIncidentId = selectedIncident?.id ?? null;
  const visibleClusters = useMemo(
    () => getDisplaySurgeClusters(visibleIncidents),
    [visibleIncidents],
  );

  const clusterForSelectedIncident = useMemo(() => {
    if (!selectedIncident) {
      return null;
    }
    return findSurgeClusterForIncident(selectedIncident, visibleClusters);
  }, [selectedIncident, visibleClusters]);

  const selectedCluster =
    selectedClusterId === null
      ? null
      : (visibleClusters.find((cluster) => cluster.cluster_id === selectedClusterId) ??
        null);

  useEffect(() => {
    selectionRef.current = effectiveSelectedIncidentId;
  }, [effectiveSelectedIncidentId]);

  const handleAfterCommand = useCallback(async () => {
    await loadIncidents();
    const id = selectionRef.current;
    if (!id) {
      setCallSessionsForSelected([]);
      return;
    }
    try {
      const rows = await fetchCallSessionsForIncident(id);
      setCallSessionsForSelected(rows);
    } catch {
      setCallSessionsForSelected([]);
    }
  }, [loadIncidents]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!effectiveSelectedIncidentId) {
        startTransition(() => {
          if (!cancelled) {
            setCallSessionsForSelected([]);
          }
        });
        return;
      }

      try {
        const rows = await fetchCallSessionsForIncident(
          effectiveSelectedIncidentId,
        );
        if (!cancelled) {
          startTransition(() => {
            setCallSessionsForSelected(rows);
          });
        }
      } catch {
        if (!cancelled) {
          startTransition(() => {
            setCallSessionsForSelected([]);
          });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [effectiveSelectedIncidentId]);

  const activeCallSession =
    callSessionsForSelected.find((s) => s.status === "active") ??
    callSessionsForSelected[0] ??
    null;

  return (
    <DashboardPersonaProvider>
      <main className="flex h-screen min-h-[720px] flex-col overflow-hidden bg-[#000814] text-[#dbe7f3]">
        <TopBar
          incidents={visibleIncidents}
          mode={queueFilters.mode}
          onModeChange={setMode}
          usingFallback={usingFallback}
          realtimeConnected={realtimeStatus === "connected"}
          onRefresh={loadIncidents}
          isRefreshing={clientMounted && loadState === "loading"}
        />

        <IncidentFeedBanner loadMessage={loadMessage} loadState={loadState} />

        <DemoControls
          onAfterSimulation={refetchIncidentsQuiet}
          onRefreshIncidents={loadIncidents}
          onResetView={resetDashboardView}
          mode={queueFilters.mode}
          setMode={setMode}
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[340px_minmax(0,1fr)_360px] xl:grid-cols-[360px_minmax(0,1fr)_380px]">
        <IncidentQueue
          incidents={visibleIncidents}
          allIncidents={incidents}
          selectedIncidentId={effectiveSelectedIncidentId}
          filters={queueFilters}
          onFiltersChange={setQueueFilters}
          onSelectIncident={selectIncident}
        />

        <section className="relative min-h-0 min-w-0 overflow-hidden bg-[#000814]">
          <CommandMap
            incidents={visibleIncidents}
            clusters={visibleClusters}
            mode={queueFilters.mode}
            responders={responders}
            responderMessage={responderMessage}
            selectedIncidentId={effectiveSelectedIncidentId}
            selectedClusterId={selectedCluster?.cluster_id ?? null}
            onSelectIncident={selectIncident}
            onSelectCluster={selectCluster}
            onClearCluster={() => setSelectedClusterId(null)}
          />

          {loadState === "loading" && incidents.length === 0 ? (
            <div
              className="pointer-events-none absolute inset-x-4 bottom-4 z-20 rounded-2xl border border-[rgba(112,214,255,0.18)] bg-[#000814]/90 px-4 py-3 text-sm text-[#dbe7f3] shadow-2xl backdrop-blur"
              role="status"
            >
              Loading incidents from local API while the command map initializes...
            </div>
          ) : null}
        </section>

        {selectedCluster ? (
          <ClusterDrawer
            cluster={selectedCluster}
            incidents={visibleIncidents}
            onSelectIncident={selectIncident}
          />
        ) : (
          <IncidentDrawer
            incident={selectedIncident}
            operatorActions={apiOperatorActions}
            onActionComplete={handleAfterCommand}
            activeCallSession={activeCallSession}
            onViewCluster={
              clusterForSelectedIncident
                ? () => selectCluster(clusterForSelectedIncident.cluster_id)
                : undefined
            }
            mapClusterId={clusterForSelectedIncident?.cluster_id ?? null}
          />
        )}
        </div>
      </main>
    </DashboardPersonaProvider>
  );
}
