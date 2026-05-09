/**
 * Renders the safe-tool registry as a markdown block that gets appended to
 * the Call Triage Agent's system prompt.
 *
 * Filtering by `mode` matches what `executeAllowedToolRequests` enforces, so
 * the AI only sees tools it is actually allowed to request in the current
 * call's mode. This keeps the prompt short and prevents Gemma from emitting
 * tool requests that the dispatcher would immediately reject as
 * `mode_not_allowed`.
 */

import {
  isModeAllowed,
  listToolDefinitions,
  type ToolDefinition,
} from "@/lib/ai/toolRegistry";
import type { AppMode } from "@/lib/types/enums";

const renderToolEntry = (tool: ToolDefinition): string => {
  const requestBlock = JSON.stringify(
    {
      tool: tool.name,
      args: tool.argsExample,
      reason: "<short why-this-tool string>",
    },
    null,
    2
  );
  return [
    `- ${tool.name} (safety_level: ${tool.safety_level})`,
    `  ${tool.description}`,
    `  Allowed modes: ${tool.allowedModes.join(", ")}`,
    "  Example tool_requests entry (must include all three keys: tool, args, reason):",
    requestBlock
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n"),
  ].join("\n");
};

export const buildToolCatalogForPrompt = (mode: AppMode): string => {
  const tools = listToolDefinitions().filter((t) => isModeAllowed(t, mode));
  if (tools.length === 0) {
    return "No tools are exposed in this mode.";
  }
  const header = [
    `Available tools for mode "${mode}" (use the exact name; backend enforces this list):`,
    "",
    "Every entry in tool_requests MUST be an object with exactly these keys:",
    "  - tool: string (one of the tool names below)",
    "  - args: object (shape per tool; see each tool's example)",
    "  - reason: string (one short sentence)",
    "Do NOT use { name, input }, { function, arguments }, or any other shape.",
    "",
  ].join("\n");
  return header + tools.map(renderToolEntry).join("\n\n");
};

/**
 * Optional guidance the prompt can include to nudge the agent toward
 * exercising the tool loop on the demo trigger phrase. Kept separate so the
 * mock agent doesn't accidentally read it.
 */
export const DEMO_TOOL_HINT = [
  "If the caller says a phrase starting with \"demo geocode\", emit a",
  "geocode_location tool_request with the location_text from after the trigger",
  "(default to \"Dana Porter Library\" if missing).",
].join("\n");
