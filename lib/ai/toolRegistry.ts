/**
 * Safe tool registry for the Call Triage Agent's two-pass loop.
 *
 * The AI emits `tool_requests`, but only tools listed here can be executed.
 * Each entry binds:
 *  - a Zod arg schema for shape validation,
 *  - the modes in which the tool is allowed,
 *  - a per-tool timeout (ms),
 *  - a `safety_level` (read_only vs operator_confirm_required), and
 *  - the executor function.
 *
 * The dispatcher in `executeAllowedToolRequests.ts` is the only thing that
 * should iterate over this registry. AI prompts/providers must never receive
 * the executor functions themselves — only tool names + arg shapes.
 */

import type { ZodTypeAny } from "zod";
import type { AppMode } from "@/lib/types/enums";
import type {
  SafeToolName,
  ToolExecutionSource,
  ToolSafetyLevel,
} from "@/lib/ai/toolResults";

import {
  geocodeLocation,
  geocodeLocationArgsSchema,
} from "@/lib/tools/geocodeLocation";
import {
  responderLookup,
  responderLookupArgsSchema,
} from "@/lib/tools/responderLookup";
import {
  eventZoneLookup,
  eventZoneLookupArgsSchema,
} from "@/lib/tools/eventZoneLookup";
import { smsDraft, smsDraftArgsSchema } from "@/lib/tools/smsDraft";

export type ToolExecutorOutput = {
  data: unknown;
  source: ToolExecutionSource;
};

export type ToolExecutor = (args: unknown) => Promise<ToolExecutorOutput>;

export type ToolDefinition = {
  name: SafeToolName;
  description: string;
  argsSchema: ZodTypeAny;
  allowedModes: ReadonlyArray<AppMode>;
  safety_level: ToolSafetyLevel;
  timeoutMs: number;
  executor: ToolExecutor;
  /**
   * Concrete example of the args shape — surfaced in the system prompt so AI
   * providers (Gemma, etc.) can emit valid `tool_requests` without us shipping
   * full Zod-to-JSON-schema conversion.
   */
  argsExample: Record<string, unknown>;
};

const ALL_MODES: ReadonlyArray<AppMode> = ["normal", "disaster", "world_cup"];

const definitions: ReadonlyArray<ToolDefinition> = [
  {
    name: "geocode_location",
    description: "Resolve a free-text location to coordinates with confidence.",
    argsSchema: geocodeLocationArgsSchema,
    allowedModes: ALL_MODES,
    safety_level: "read_only",
    timeoutMs: 5_000,
    executor: geocodeLocation as ToolExecutor,
    argsExample: {
      location_text: "BMO Field, Toronto",
      city_context: "Toronto",
      country_context: "Canada",
    },
  },
  {
    name: "responder_lookup",
    description: "Find nearest available responders for an incident location.",
    argsSchema: responderLookupArgsSchema,
    allowedModes: ALL_MODES,
    safety_level: "read_only",
    timeoutMs: 5_000,
    executor: responderLookup as ToolExecutor,
    argsExample: {
      incident_coordinates: { lat: 43.6532, lng: -79.3832 },
      responder_types: ["ambulance", "fire", "police"],
      max_results: 3,
    },
  },
  {
    name: "event_zone_lookup",
    description:
      "Match a coordinate against disaster impact zones or world-cup event zones.",
    argsSchema: eventZoneLookupArgsSchema,
    allowedModes: ["disaster", "world_cup"],
    safety_level: "read_only",
    timeoutMs: 5_000,
    executor: eventZoneLookup as ToolExecutor,
    argsExample: {
      coordinates: { lat: 43.6346, lng: -79.4151 },
      mode: "world_cup",
    },
  },
  {
    name: "sms_draft",
    description:
      "Draft a short factual SMS body for operator review (does not send).",
    argsSchema: smsDraftArgsSchema,
    allowedModes: ALL_MODES,
    safety_level: "operator_confirm_required",
    timeoutMs: 3_000,
    executor: smsDraft as ToolExecutor,
    argsExample: {
      incident_id: "00000000-0000-0000-0000-000000000001",
      language: "en",
      summary: "Caller reported a minor injury near Gate 3. No loss of consciousness.",
      recommended_action: "Proceed to the nearest medical tent for evaluation.",
      destination: {
        name: "Medical Tent — Gate 2",
      },
      reference_code: "INC-00000001",
    },
  },
];

const REGISTRY: ReadonlyMap<SafeToolName, ToolDefinition> = new Map(
  definitions.map((d) => [d.name, d])
);

export const getToolDefinition = (
  name: SafeToolName
): ToolDefinition | undefined => REGISTRY.get(name);

export const isModeAllowed = (
  definition: ToolDefinition,
  mode: AppMode
): boolean => definition.allowedModes.includes(mode);

export const listToolDefinitions = (): ReadonlyArray<ToolDefinition> =>
  definitions;
