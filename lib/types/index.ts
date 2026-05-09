/**
 * Platform contract barrel — scoped to docs through
 * `project_full_context_and_future_features.md` §10 (core pipeline + suggested layout),
 * excluding §11+ (future-only) contracts.
 */

export * from "./enums";
export * from "./json";
export * from "./geo";
export * from "./domain";
export * from "./api";
export * from "./tools";

export type {
  TriageAgentOutput,
  TriageAgentValidationIssue,
} from "../ai/schemas/triageAgentOutputSchema";
export { TriageAgentOutputValidationError, validateTriageAgentOutput } from "../ai/schemas/triageAgentOutputSchema";
export {
  triageAgentOutputSchema,
} from "../ai/schemas/triageAgentOutputSchema";
