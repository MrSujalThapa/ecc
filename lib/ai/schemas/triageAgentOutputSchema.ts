import { z } from "zod";
import {
  APP_MODES,
  CALL_SESSION_STATUSES,
  LOCATION_STATUSES,
  OPERATOR_TRANSFER_STATUSES,
  TRIAGE_SYSTEM_ACTIONS,
  URGENCY_LEVELS,
} from "@/lib/types/enums";

export const urgencyEnum = z.enum(URGENCY_LEVELS);
export const modeEnum = z.enum(APP_MODES);
export const locationStatusEnum = z.enum(LOCATION_STATUSES);
export const systemActionEnum = z.enum(TRIAGE_SYSTEM_ACTIONS);
export const callSessionStatusEnum = z.enum(CALL_SESSION_STATUSES);
export const operatorTransferStatusEnum = z.enum(OPERATOR_TRANSFER_STATUSES);

const coordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const toolRequestSchema = z.object({
  tool: z.string(),
  args: z.record(z.string(), z.unknown()),
  reason: z.string(),
});

const incidentPatchSchema = z.object({
  mode: modeEnum.optional(),
  urgency: urgencyEnum.optional(),
  incident_type: z.string().optional(),
  status: z.string().optional(),
  operator_required: z.boolean().optional(),
  control_state: z.string().optional(),
  ai_active: z.boolean().optional(),
  location_status: locationStatusEnum.optional(),
  location_confidence: z.number().optional(),
  location: z.string().optional(),
  coordinates: coordinatesSchema.optional(),
  summary: z.string().optional(),
  collected_fields: z.record(z.string(), z.unknown()).optional(),
  missing_fields: z.array(z.string()).optional(),
  recommended_action: z.string().optional(),
  priority_score: z.number().optional(),
  cluster_id: z.string().optional(),
});

const callSessionPatchSchema = z.object({
  status: callSessionStatusEnum.optional(),
  ai_active: z.boolean().optional(),
  turn_count: z.number().optional(),
  next_question: z.string().nullable().optional(),
  last_model_confidence: z.number().optional(),
  should_escalate: z.boolean().optional(),
  operator_transfer_status: operatorTransferStatusEnum.optional(),
});

export const systemActionItemSchema = z.object({
  action: systemActionEnum,
  args: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().optional(),
});

export type SystemAction = z.infer<typeof systemActionItemSchema>;
export type TriageToolRequest = z.infer<typeof toolRequestSchema>;

export const triageAgentOutputSchema = z.object({
  tool_requests: z.array(toolRequestSchema).default([]),
  incident_patch: incidentPatchSchema,
  call_session_patch: callSessionPatchSchema,
  system_actions: z.array(systemActionItemSchema).default([]),
  say_to_caller: z
    .string()
    .min(1, "say_to_caller must be a non-empty string"),
});

export type TriageAgentOutput = z.infer<typeof triageAgentOutputSchema>;

export type TriageAgentValidationIssue = {
  path: (string | number | symbol)[];
  message: string;
  code?: string;
};

export class TriageAgentOutputValidationError extends Error {
  readonly issues: TriageAgentValidationIssue[];

  constructor(message: string, issues: TriageAgentValidationIssue[]) {
    super(message);
    this.name = "TriageAgentOutputValidationError";
    this.issues = issues;
  }
}

export const validateTriageAgentOutput = (input: unknown): TriageAgentOutput => {
  const result = triageAgentOutputSchema.safeParse(input);
  if (!result.success) {
    const issues: TriageAgentValidationIssue[] = result.error.issues.map(
      (i) => ({
        path: [...i.path],
        message: i.message,
        code: i.code,
      })
    );
    const summary = issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new TriageAgentOutputValidationError(
      `Invalid TriageAgentOutput: ${summary}`,
      issues
    );
  }
  return result.data;
};
