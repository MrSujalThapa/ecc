import { z } from "zod";
import { safeToolNameSchema } from "./toolRequestSchema";

/**
 * Backend-produced tool result validation for the future agentic flow.
 *
 * This schema validates normalized ToolResult objects only. It does not call
 * backend tools, Mapbox, Supabase, or any external service.
 */
export const toolExecutionSourceSchema = z.enum([
  "mock",
  "mapbox_mcp",
  "mapbox_api",
  "static_context",
  "database",
  "manual",
]);

const toolResultErrorSchema = z.object({
  code: z.string().min(1, "ToolResult.error.code must be a non-empty string"),
  message: z
    .string()
    .min(1, "ToolResult.error.message must be a non-empty string"),
  details: z.unknown().optional(),
});

export const toolResultSchema = z.object({
  tool_request_id: z
    .string()
    .min(1, "ToolResult.tool_request_id must be a non-empty string"),
  tool: safeToolNameSchema,
  ok: z.boolean(),
  source: toolExecutionSourceSchema,
  data: z.unknown().optional(),
  error: toolResultErrorSchema.optional(),
  created_at: z
    .string()
    .min(1, "ToolResult.created_at must be a non-empty string"),
});

export const toolResultsSchema = z.array(toolResultSchema);

export type ToolExecutionSource = z.infer<typeof toolExecutionSourceSchema>;
export type ToolResult = z.infer<typeof toolResultSchema>;

export function validateToolResults(input: unknown): ToolResult[] {
  return toolResultsSchema.parse(input);
}
