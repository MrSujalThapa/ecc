import type { Incident } from "@/lib/types";

export const urgencyRank: Record<Incident["urgency"], number> = {
  critical: 4,
  urgent: 3,
  non_emergency: 2,
  unknown: 1,
};

export const urgencyLabel: Record<Incident["urgency"], string> = {
  critical: "Critical",
  urgent: "Urgent",
  non_emergency: "Non-emergency",
  unknown: "Unknown",
};

export const urgencyMarkerClass: Record<Incident["urgency"], string> = {
  critical: "border-red-300 bg-red-500 shadow-red-500/50",
  urgent: "border-orange-300 bg-orange-400 shadow-orange-400/40",
  non_emergency: "border-sky-300 bg-sky-400 shadow-sky-400/30",
  unknown: "border-zinc-300 bg-zinc-400 shadow-zinc-400/30",
};

export const urgencyBadgeClass: Record<Incident["urgency"], string> = {
  critical: "border-red-400/40 bg-red-500/15 text-red-100",
  urgent: "border-orange-400/40 bg-orange-500/15 text-orange-100",
  non_emergency: "border-sky-400/40 bg-sky-500/15 text-sky-100",
  unknown: "border-zinc-400/40 bg-zinc-500/15 text-zinc-100",
};

export const formatIncidentType = (type: string | null | undefined): string =>
  (type ?? "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Unknown";

export const getIncidentDisplayId = (incident: Incident): string =>
  incident.public_id ?? incident.id.slice(0, 8);

export const activeStatusRank: Record<string, number> = {
  collecting_location: 5,
  transferring_to_operator: 4,
  human_active: 3,
  active_call: 2,
  ai_handled: 1,
  resolved: 0,
  abandoned: 0,
};

export const formatStatusLabel = (value: string | null | undefined): string =>
  value?.replaceAll("_", " ") ?? "Unknown";

export const formatNullable = (
  value: string | number | null | undefined,
  fallback = "Not available",
): string => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
};

export const formatTimestamp = (value: string | null | undefined): string => {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export function sortIncidentsForQueue(incidents: Incident[]): Incident[] {
  return [...incidents].sort((a, b) => {
    const urgencyDelta = urgencyRank[b.urgency] - urgencyRank[a.urgency];
    if (urgencyDelta !== 0) return urgencyDelta;

    const priorityDelta = (b.priority_score ?? 0) - (a.priority_score ?? 0);
    if (priorityDelta !== 0) return priorityDelta;

    const activeDelta =
      (activeStatusRank[b.status] ?? 1) - (activeStatusRank[a.status] ?? 1);
    if (activeDelta !== 0) return activeDelta;

    return (
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  });
}
