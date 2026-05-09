import type { TriageAgentOutput } from "@/lib/ai/schemas/triageAgentOutputSchema";
import type { CallSession, Incident } from "@/lib/types/domain";
import type { Json } from "@/lib/types/json";
import { isoNow } from "./iso-now";

const mergeRecord = (
  base: Record<string, Json>,
  patch: Record<string, unknown> | undefined
): Record<string, Json> => {
  if (!patch) return base;
  const next = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    next[k] = v as Json;
  }
  return next;
};

export const applyIncidentPatch = (
  incident: Incident,
  patch: TriageAgentOutput["incident_patch"]
): Incident => {
  const next: Incident = {
    ...incident,
    updated_at: isoNow(),
    last_updated_by: "triage_agent",
  };

  const entries = Object.entries(patch) as [
    keyof TriageAgentOutput["incident_patch"],
    unknown,
  ][];

  for (const [key, value] of entries) {
    if (value === undefined) continue;
    if (key === "collected_fields" && value && typeof value === "object") {
      next.collected_fields = mergeRecord(
        next.collected_fields,
        value as Record<string, unknown>
      );
      continue;
    }
    if (key === "missing_fields" && Array.isArray(value)) {
      next.missing_fields = value.filter((x): x is string => typeof x === "string");
      continue;
    }
    (next as Record<string, unknown>)[key] = value;
  }

  return next;
};

export const applyCallSessionPatch = (
  session: CallSession,
  patch: TriageAgentOutput["call_session_patch"]
): CallSession => {
  const next: CallSession = { ...session, updated_at: isoNow() };
  const entries = Object.entries(patch) as [
    keyof TriageAgentOutput["call_session_patch"],
    unknown,
  ][];

  for (const [key, value] of entries) {
    if (value === undefined) continue;
    (next as Record<string, unknown>)[key] = value;
  }

  return next;
};

export const bumpTurnCount = (session: CallSession): CallSession => ({
  ...session,
  turn_count: session.turn_count + 1,
  updated_at: isoNow(),
});
