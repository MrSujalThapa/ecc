/**
 * Safe tool registry for Call Triage Agent (project_plan Main Step 6.3,
 * project_details tool examples, project_full_context §10.4–10.5).
 */

import type { Coordinates } from "./geo";
import type { TriageToolName } from "./enums";

export type GeocodeLocationArgs = {
  location_text: string;
  /** Optional disambiguation (full_context example). */
  city_context?: string;
};

export type GeocodeLocationResult = {
  tool: "geocode_location";
  success: boolean;
  result?: {
    location: string;
    coordinates: Coordinates;
    confidence: number;
  };
  error?: string;
};

export type EventZoneLookupArgs = {
  coordinates: Coordinates;
  mode_hint?: string;
};

export type EventZoneLookupResult = {
  tool: "event_zone_lookup";
  success: boolean;
  result?: {
    zones: string[];
    nearest_help_point?: string | null;
  };
  error?: string;
};

export type ResponderLookupArgs = {
  coordinates: Coordinates;
  radius_km?: number;
};

export type ResponderLookupResult = {
  tool: "responder_lookup";
  success: boolean;
  result?: {
    responders: Array<{
      id: string;
      type: string;
      display_name: string;
      distance_km: number;
    }>;
  };
  error?: string;
};

export type TriageToolRequestBase = {
  tool: TriageToolName;
  args: Record<string, unknown>;
  reason: string;
};
