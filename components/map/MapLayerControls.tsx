"use client";

import { useMemo } from "react";
import type { AppMode } from "@/lib/types";
import {
  mapLayerLabels,
  type MapLayerId,
  type MapLayerVisibility,
} from "@/lib/map/layers";

type MapLayerControlsProps = {
  mode: AppMode | "all";
  visibility: MapLayerVisibility;
  onToggleLayer: (layer: MapLayerId) => void;
};

type LayerGroup = {
  title: string;
  description?: string;
  layerIds: MapLayerId[];
  disabled?: boolean;
};

const buildLayerGroups = (mode: AppMode | "all"): LayerGroup[] => {
  const showDisasterStack =
    mode === "disaster" || mode === "world_cup" || mode === "all";
  const showEventLayers = mode === "world_cup" || mode === "all";

  const groups: LayerGroup[] = [
    {
      title: "Core",
      description: "Incidents, responders, and derived cluster markers",
      layerIds: ["incidents", "responders", "clusters"],
    },
  ];

  if (showDisasterStack) {
    groups.push({
      title: "Disaster",
      description: "Heatmap, impact zones, blocked roads (disaster, World Cup, or all modes)",
      layerIds: ["heatmap", "disasterZones", "blockedRoads"],
    });
  }

  if (showEventLayers) {
    groups.push({
      title: "World Cup",
      description: "Event infrastructure layers",
      layerIds: ["eventLayers"],
    });
  }

  groups.push({
    title: "Later",
    layerIds: ["routeLines"],
    disabled: true,
  });

  return groups;
};

export function MapLayerControls({
  mode,
  visibility,
  onToggleLayer,
}: MapLayerControlsProps) {
  const layerGroups = useMemo(() => buildLayerGroups(mode), [mode]);

  return (
    <section className="pointer-events-auto absolute right-4 top-24 z-20 w-56 rounded-2xl border border-white/10 bg-[#000814]/85 p-3 text-white shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
          Layers
        </h2>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-100">
          Phase 11
        </span>
      </div>

      <div className="space-y-3">
        {layerGroups.map((group) => (
          <div key={group.title} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {group.title}
              </p>
              {group.description ? (
                <span className="text-[10px] text-slate-500">
                  {group.description}
                </span>
              ) : null}
            </div>
            {group.layerIds.map((layerId) => (
              <LayerToggle
                key={layerId}
                checked={group.disabled ? false : visibility[layerId]}
                disabled={Boolean(group.disabled)}
                label={mapLayerLabels[layerId]}
                onClick={
                  group.disabled ? undefined : () => onToggleLayer(layerId)
                }
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function LayerToggle({
  checked,
  disabled = false,
  label,
  onClick,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#040f16] px-3 py-2 text-left text-xs font-medium text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-white/10 disabled:hover:bg-[#040f16]"
    >
      <span>{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          disabled
            ? "bg-[#000814] text-slate-500"
            : checked
              ? "bg-emerald-300 text-emerald-950"
              : "bg-[#000814] text-slate-400"
        }`}
      >
        {disabled ? "Later" : checked ? "On" : "Off"}
      </span>
    </button>
  );
}
