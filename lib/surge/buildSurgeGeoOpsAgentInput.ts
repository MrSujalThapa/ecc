/**
 * Surge / GeoOps agent input assembly (`project_plan.md` Main Step 14.1).
 *
 * Member 3 integrates model + tool loops here or beside `runSurgeGeoOpsAgent`:
 * - pass `recentToolResults` after `executeAllowedToolRequests`
 * - switch `provider` behavior inside `runSurgeGeoOpsAgent` when ready
 */

import type { RunSurgeGeoOpsAgentInput } from "@/lib/ai/agents/surgeGeoOpsAgent";
import type { SurgeAnalyzeRequest } from "@/lib/types/api";
import type { Incident } from "@/lib/types/domain";

export type BuildSurgeGeoOpsAgentInputParams = {
  parsed: SurgeAnalyzeRequest;
  cohort: Incident[];
  respondersRecords?: Array<Record<string, unknown>>;
  eventLayerRecords?: Array<Record<string, unknown>>;
  /**
   * Results from a controlled tool pass (e.g. route / zone lookups).
   * Member 1/Member 3: populate when the GeoOps tool loop is wired.
   */
  recentToolResults?: unknown[];
};

/**
 * Provider for GeoOps runs: dedicated override, else same as call triage.
 * `runSurgeGeoOpsAgent` may still ignore this until the model-backed path lands.
 */
export const resolveGeoOpsProvider = (): string | null => {
  const geo = process.env.GEOOPS_PROVIDER?.trim();
  if (geo) return geo;
  const ai = process.env.AI_PROVIDER?.trim();
  return ai && ai.length > 0 ? ai : null;
};

export const buildSurgeGeoOpsAgentInput = (
  params: BuildSurgeGeoOpsAgentInputParams
): RunSurgeGeoOpsAgentInput => ({
  mode: params.parsed.mode,
  activeIncidents: params.cohort.map((i) => ({ ...i }) as Record<string, unknown>),
  responders: params.respondersRecords,
  eventLayers: params.eventLayerRecords,
  recentToolResults: params.recentToolResults,
  provider: resolveGeoOpsProvider(),
});

/**
 * Derives a persisted `priority_score` from `top_priority_incident_ids`
 * (`project_plan.md` §14.2). Higher rank → higher score (1.0 … ~0.55).
 */
export const priorityScoreFromSurgeRank = (
  incidentId: string,
  orderedIds: readonly string[]
): number | null => {
  const idx = orderedIds.indexOf(incidentId);
  if (idx === -1) return null;
  const n = orderedIds.length;
  if (n <= 1) return 1;
  return Math.round((1 - (idx / (n - 1)) * 0.45) * 1000) / 1000;
};
