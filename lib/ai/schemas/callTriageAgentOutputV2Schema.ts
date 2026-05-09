import { z } from "zod";
import { modeEnum } from "./triageAgentOutputSchema";
import { toolRequestSchema } from "./toolRequestSchema";

/**
 * Draft output contract for the future agentic Call Triage Agent.
 *
 * This schema is preparation only. It is not wired into runtime, does not
 * replace `triageAgentOutputSchema`, and does not call providers, backend
 * services, databases, or tool executors.
 */

export const agentDecisionSchema = z.enum([
  "continue_ai_handling",
  "complete_ai_report",
  "ask_location_then_escalate",
  "escalate_to_operator",
  "operator_review_recommended",
]);

export const languageStateSchema = z.object({
  detected_language: z.string().nullable(),
  translated_to_english: z.boolean(),
  caller_response_language: z
    .string()
    .min(1, "caller_response_language must be a non-empty string"),
});

export const callerResponseSchema = z.object({
  type: z.enum(["say", "transfer_notice", "end_call"]),
  text: z.string().min(1, "caller_response.text must be non-empty"),
  language: z.string().min(1, "caller_response.language must be non-empty"),
});

export const operatorRecommendationSchema = z.object({
  operator_required: z.boolean(),
  priority_reason: z.string().nullable(),
  recommended_action: z.string().nullable(),
});

export const smsDraftStateSchema = z.object({
  should_send: z.boolean(),
  message: z.string().nullable(),
  language: z.string().nullable(),
});

const coordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const mapRecommendationSchema = z.object({
  focus_coordinates: coordinatesSchema.nullable().optional(),
  relevant_zone_ids: z.array(z.string()).optional(),
  nearest_help_point_id: z.string().nullable().optional(),
  route_recommendation_ids: z.array(z.string()).optional(),
  responder_recommendation_ids: z.array(z.string()).optional(),
});

const confidenceScoreSchema = z
  .number()
  .min(0, "confidence values must be at least 0")
  .max(1, "confidence values must be at most 1");

export const agentConfidenceSchema = z.object({
  overall: confidenceScoreSchema,
  location: confidenceScoreSchema.nullable(),
  urgency: confidenceScoreSchema,
});

export const callTriageAgentOutputV2Schema = z.object({
  schema_version: z.literal("2.0"),
  mode: modeEnum,
  language: languageStateSchema,
  decision: agentDecisionSchema,
  tool_requests: z.array(toolRequestSchema),
  incident_patch: z.record(z.string(), z.unknown()),
  call_session_patch: z.record(z.string(), z.unknown()),
  caller_response: callerResponseSchema,
  operator_recommendation: operatorRecommendationSchema,
  sms_draft: smsDraftStateSchema,
  map_recommendation: mapRecommendationSchema,
  confidence: agentConfidenceSchema,
});

export type AgentDecision = z.infer<typeof agentDecisionSchema>;
export type LanguageState = z.infer<typeof languageStateSchema>;
export type CallerResponse = z.infer<typeof callerResponseSchema>;
export type OperatorRecommendation = z.infer<
  typeof operatorRecommendationSchema
>;
export type SmsDraftState = z.infer<typeof smsDraftStateSchema>;
export type MapRecommendation = z.infer<typeof mapRecommendationSchema>;
export type AgentConfidence = z.infer<typeof agentConfidenceSchema>;
export type CallTriageAgentOutputV2 = z.infer<
  typeof callTriageAgentOutputV2Schema
>;

export type CallTriageAgentOutputV2ValidationIssue = {
  path: (string | number | symbol)[];
  message: string;
  code?: string;
};

export class CallTriageAgentOutputV2ValidationError extends Error {
  readonly issues: CallTriageAgentOutputV2ValidationIssue[];

  constructor(
    message: string,
    issues: CallTriageAgentOutputV2ValidationIssue[]
  ) {
    super(message);
    this.name = "CallTriageAgentOutputV2ValidationError";
    this.issues = issues;
  }
}

export function validateCallTriageAgentOutputV2(
  input: unknown
): CallTriageAgentOutputV2 {
  const result = callTriageAgentOutputV2Schema.safeParse(input);
  if (!result.success) {
    const issues: CallTriageAgentOutputV2ValidationIssue[] =
      result.error.issues.map((issue) => ({
        path: [...issue.path],
        message: issue.message,
        code: issue.code,
      }));
    const summary = issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new CallTriageAgentOutputV2ValidationError(
      `Invalid CallTriageAgentOutputV2: ${summary}`,
      issues
    );
  }

  return result.data;
}
