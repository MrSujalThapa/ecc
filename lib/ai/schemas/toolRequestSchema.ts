import { z } from "zod";

/**
 * Safe tool names the AI may request in the future agentic flow.
 *
 * This schema validates requests only. It does not execute tools, import
 * backend code, or call external services. Backend owns validation by tool,
 * execution, persistence, audit logs, and side effects.
 */
export const safeToolNameSchema = z.enum([
  "geocode_location",
  "event_zone_lookup",
  "responder_lookup",
  "sms_draft",
]);

const toolSafetyLevelSchema = z.enum([
  "read_only",
  "operator_confirm_required",
]);

export const toolRequestSchema = z.object({
  id: z.string().min(1, "ToolRequest.id must be a non-empty string"),
  tool: safeToolNameSchema,
  args: z.record(z.string(), z.unknown()),
  reason: z
    .string()
    .min(1, "ToolRequest.reason must be a non-empty string"),
  safety_level: toolSafetyLevelSchema,
});

export const toolRequestsSchema = z.array(toolRequestSchema);

export type SafeToolName = z.infer<typeof safeToolNameSchema>;
export type ToolRequest = z.infer<typeof toolRequestSchema>;

export function validateToolRequests(input: unknown): ToolRequest[] {
  return toolRequestsSchema.parse(input);
}
