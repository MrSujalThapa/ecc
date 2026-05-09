export const DASHBOARD_PERSONA_IDS = ["developer", "operator", "executive"] as const;

export type DashboardPersonaId = (typeof DASHBOARD_PERSONA_IDS)[number];

export const DASHBOARD_PERSONA_OPTIONS: {
  id: DashboardPersonaId;
  label: string;
  description: string;
}[] = [
  {
    id: "developer",
    label: "Developer",
    description: "Simulation controls, infra badges, API session details, and export tools.",
  },
  {
    id: "operator",
    label: "Operator / dispatcher",
    description: "Operational triage without lab controls or internal plumbing.",
  },
  {
    id: "executive",
    label: "Executive (demo)",
    description: "Story-focused view with minimal technical and scoring detail.",
  },
];

/** UI visibility derived from the active dashboard persona. */
export type DashboardPersonaVisibility = {
  showDemoControls: boolean;
  showInfraStatusBadges: boolean;
  /** Non-error incident feed messages (e.g. Supabase wiring hints). */
  showVerboseIncidentFeedBanner: boolean;
  showOperatorLoadPanel: boolean;
  showOperatorLoadBreakdownLine: boolean;
  showCallSessionApiBlock: boolean;
  showInternalIncidentId: boolean;
  showDetailsPriorityScore: boolean;
  showDetailsControlAndAi: boolean;
  showDetailsUpdatedBy: boolean;
  /** Raw cluster id (`local-…`); when false, cluster actions use plain-language labels. */
  showClusterTechnicalId: boolean;
  showLocationCoordinateFields: boolean;
  showTranscriptInfrastructure: boolean;
  /** Vendor / archived transcript URL block (not the .txt export). */
  showTranscriptDeveloperTools: boolean;
  showQueuePriorityScore: boolean;
  showQueueControlState: boolean;
  showQueueAiActiveBadge: boolean;
  showClusterDrawerTechnicalIds: boolean;
};

const allTrue: DashboardPersonaVisibility = {
  showDemoControls: true,
  showInfraStatusBadges: true,
  showVerboseIncidentFeedBanner: true,
  showOperatorLoadPanel: true,
  showOperatorLoadBreakdownLine: true,
  showCallSessionApiBlock: true,
  showInternalIncidentId: true,
  showDetailsPriorityScore: true,
  showDetailsControlAndAi: true,
  showDetailsUpdatedBy: true,
  showClusterTechnicalId: true,
  showLocationCoordinateFields: true,
  showTranscriptInfrastructure: true,
  showTranscriptDeveloperTools: true,
  showQueuePriorityScore: true,
  showQueueControlState: true,
  showQueueAiActiveBadge: true,
  showClusterDrawerTechnicalIds: true,
};

export const getDashboardPersonaVisibility = (
  persona: DashboardPersonaId,
): DashboardPersonaVisibility => {
  if (persona === "developer") {
    return { ...allTrue };
  }

  if (persona === "operator") {
    return {
      ...allTrue,
      showDemoControls: false,
      showInfraStatusBadges: false,
      showVerboseIncidentFeedBanner: false,
      showCallSessionApiBlock: false,
      showInternalIncidentId: false,
      showClusterTechnicalId: false,
      showDetailsUpdatedBy: false,
      showTranscriptInfrastructure: false,
      showTranscriptDeveloperTools: false,
      showClusterDrawerTechnicalIds: false,
    };
  }

  return {
    ...allTrue,
    showDemoControls: false,
    showInfraStatusBadges: false,
    showVerboseIncidentFeedBanner: false,
    showOperatorLoadPanel: false,
    showOperatorLoadBreakdownLine: false,
    showCallSessionApiBlock: false,
    showInternalIncidentId: false,
    showDetailsPriorityScore: false,
    showDetailsControlAndAi: false,
    showDetailsUpdatedBy: false,
    showClusterTechnicalId: false,
    showLocationCoordinateFields: false,
    showTranscriptInfrastructure: false,
    showTranscriptDeveloperTools: false,
    showQueuePriorityScore: false,
    showQueueControlState: false,
    showQueueAiActiveBadge: false,
    showClusterDrawerTechnicalIds: false,
  };
};

export const DASHBOARD_PERSONA_STORAGE_KEY = "ecc.dashboard.persona";

export const parseDashboardPersona = (raw: string | null): DashboardPersonaId | null => {
  if (!raw) {
    return null;
  }
  return DASHBOARD_PERSONA_IDS.includes(raw as DashboardPersonaId)
    ? (raw as DashboardPersonaId)
    : null;
};
