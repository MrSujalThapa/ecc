"use client";

import { useCallback, useState } from "react";
import type { AppMode } from "@/lib/types";
import {
  postSimulateDisaster,
  postSimulateWorldCup,
} from "@/lib/data/simulationClient";
import { useDashboardPersona } from "@/components/dashboard/DashboardPersonaContext";

const DEFAULT_SIMULATE_BATCH_SIZE = 50;

type DemoControlsProps = {
  /** Refetch incident list after a successful simulation (Member 4: refetch after trigger). */
  onAfterSimulation: () => Promise<void>;
  onRefreshIncidents: () => Promise<void>;
  onResetView: () => void;
  mode: AppMode | "all";
  setMode: (mode: AppMode | "all") => void;
};

export const DemoControls = ({
  onAfterSimulation,
  onRefreshIncidents,
  onResetView,
  mode,
  setMode,
}: DemoControlsProps) => {
  const { visibility } = useDashboardPersona();

  const [simKind, setSimKind] = useState<
    "idle" | "disaster" | "world_cup" | "refresh" | "clear"
  >("idle");
  const [resetExisting, setResetExisting] = useState(false);
  const [banner, setBanner] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );

  const simBusy = simKind !== "idle";

  const handleDisaster = useCallback(async () => {
    setSimKind("disaster");
    setBanner(null);
    const r = await postSimulateDisaster({
      batch_size: DEFAULT_SIMULATE_BATCH_SIZE,
      reset_existing: resetExisting || undefined,
    });
    if (!r.ok || !r.data) {
      setBanner({
        tone: "error",
        text: `Disaster simulation failed (${r.status}): ${r.errorText.slice(0, 280)}`,
      });
      setSimKind("idle");
      return;
    }
    setMode("disaster");
    await onAfterSimulation();
    setBanner({
      tone: "ok",
      text: `Disaster simulation: created ${r.data.created_incidents.length} incident(s).`,
    });
    setSimKind("idle");
  }, [onAfterSimulation, resetExisting, setMode]);

  const handleWorldCup = useCallback(async () => {
    setSimKind("world_cup");
    setBanner(null);
    const r = await postSimulateWorldCup({
      batch_size: DEFAULT_SIMULATE_BATCH_SIZE,
      reset_existing: resetExisting || undefined,
    });
    if (!r.ok || !r.data) {
      setBanner({
        tone: "error",
        text: `World Cup simulation failed (${r.status}): ${r.errorText.slice(0, 280)}`,
      });
      setSimKind("idle");
      return;
    }
    setMode("world_cup");
    await onAfterSimulation();
    setBanner({
      tone: "ok",
      text: `World Cup simulation: created ${r.data.created_incidents.length} incident(s).`,
    });
    setSimKind("idle");
  }, [onAfterSimulation, resetExisting, setMode]);

  const handleRefresh = useCallback(async () => {
    setSimKind("refresh");
    setBanner(null);
    try {
      await onRefreshIncidents();
      setBanner({ tone: "ok", text: "Incident feed refreshed." });
    } catch (error) {
      setBanner({
        tone: "error",
        text:
          error instanceof Error
            ? `Refresh failed: ${error.message}`
            : "Refresh failed unexpectedly.",
      });
    } finally {
      setSimKind("idle");
    }
  }, [onRefreshIncidents]);

  const handleClearAllIncidents = useCallback(async () => {
    setSimKind("clear");
    setBanner(null);
    const r = await postSimulateDisaster({
      batch_size: 0,
      reset_existing: true,
    });
    if (!r.ok || !r.data) {
      setBanner({
        tone: "error",
        text: `Clear failed (${r.status}): ${r.errorText.slice(0, 280)}`,
      });
      setSimKind("idle");
      return;
    }
    setMode("all");
    await onAfterSimulation();
    setBanner({
      tone: "ok",
      text: "All incidents cleared via simulate/disaster (reset_existing + batch_size 0).",
    });
    setSimKind("idle");
  }, [onAfterSimulation, setMode]);

  const handleResetView = useCallback(() => {
    setBanner(null);
    onResetView();
    setBanner({ tone: "ok", text: "Dashboard view reset." });
  }, [onResetView]);

  if (!visibility.showDemoControls) {
    return null;
  }

  return (
    <div
      aria-busy={simBusy}
      className="flex flex-col gap-3 border-b border-[rgba(112,214,255,0.18)] bg-[#06111f] px-5 py-3 text-[#dbe7f3] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-2 sm:flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#8b9bb0]">
            Demo Controls
          </span>
          <span className="rounded-full border border-[rgba(112,214,255,0.18)] bg-[#0b1728] px-2 py-0.5 text-xs capitalize text-[#8b9bb0]">
            {mode === "all" ? "All modes" : mode.replace("_", " ")}
          </span>
          <label className="ml-1 flex cursor-pointer items-center gap-2 text-xs text-[#8b9bb0]">
            <input
              checked={resetExisting}
              className="size-3.5 rounded border-white/20 bg-[#000814]"
              disabled={simBusy}
              onChange={(e) => setResetExisting(e.target.checked)}
              type="checkbox"
            />
            Replace existing first (<code className="text-[#70d6ff]/90">reset_existing</code>)
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            aria-label="Trigger disaster simulation"
            className="rounded-full border border-[rgba(112,214,255,0.18)] bg-[#0b1728] px-3 py-1.5 text-sm font-medium text-[#dbe7f3] transition hover:border-[rgba(112,214,255,0.38)] hover:bg-[#06111f] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={simBusy}
            onClick={() => void handleDisaster()}
            type="button"
          >
            {simKind === "disaster" ? "Running..." : "Disaster simulation"}
          </button>
          <button
            aria-label="Trigger World Cup simulation"
            className="rounded-full border border-[rgba(112,214,255,0.18)] bg-[#0b1728] px-3 py-1.5 text-sm font-medium text-[#dbe7f3] transition hover:border-[rgba(112,214,255,0.38)] hover:bg-[#06111f] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={simBusy}
            onClick={() => void handleWorldCup()}
            type="button"
          >
            {simKind === "world_cup" ? "Running..." : "World Cup simulation"}
          </button>
          <button
            aria-label="Clear all incidents from the database"
            className="rounded-full border border-[#d00000]/35 bg-[#3f0d12]/45 px-3 py-1.5 text-sm font-medium text-[#ffd6d6] transition hover:bg-[#641220]/45 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={simBusy}
            onClick={() => void handleClearAllIncidents()}
            type="button"
          >
            {simKind === "clear" ? "Clearing..." : "Clear all incidents"}
          </button>
          <button
            aria-label="Refresh incidents"
            className="rounded-full border border-[rgba(112,214,255,0.38)] bg-[#06111f] px-3 py-1.5 text-sm font-medium text-[#70d6ff] transition hover:bg-[#0b1728] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={simBusy}
            onClick={() => void handleRefresh()}
            type="button"
          >
            {simKind === "refresh" ? "Refreshing..." : "Refresh incidents"}
          </button>
          <button
            aria-label="Reset dashboard view"
            className="rounded-full border border-[rgba(112,214,255,0.18)] px-3 py-1.5 text-sm font-medium text-[#8b9bb0] transition hover:bg-[#0b1728] hover:text-[#dbe7f3] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={simBusy}
            onClick={handleResetView}
            type="button"
          >
            Reset view / clear selection
          </button>
        </div>
      </div>
      {banner ? (
        <div
          className={`max-w-xl rounded-2xl border px-4 py-2 text-sm shadow-lg ${
            banner.tone === "ok"
              ? "border-[#52b788]/35 bg-[#52b788]/10 text-[#dbe7f3]"
              : "border-[#d00000]/35 bg-[#000814]/12 text-[#dbe7f3]"
          }`}
          role={banner.tone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {banner.text}
        </div>
      ) : (
        <p className="text-xs text-[#8b9bb0]">
          Phase 8:{" "}
          <code className="font-mono text-[#70d6ff]/90">
            POST /api/simulate/disaster|world-cup
          </code>
          . Optional <code className="font-mono text-[#70d6ff]/90">reset_existing</code>{" "}
          is supported; simulations refetch incidents after success.
        </p>
      )}
    </div>
  );
};
