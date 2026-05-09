/**
 * Unified Call Triage entrypoint.
 *
 * Provider behavior:
 * - "mock" → deterministic keyword-based mock agent
 * - "gemma" → Gemma provider; invalid response/errors/missing key fallback to mock
 * - "featherless" → Featherless (OpenAI-compatible API); errors / missing
 *   env fallback to mock
 *
 * The AI never writes to the database or calls external emergency systems directly.
 * Backend validates and executes any safe actions.
 */

import type { TriageAgentOutput } from "@/lib/ai/schemas/triageAgentOutputSchema";
import { validateTriageAgentOutput } from "@/lib/ai/schemas/triageAgentOutputSchema";
import { generateTriageJsonViaFeatherless } from "@/lib/ai/providers/featherlessClient";
import { generateTriageJsonViaGemma } from "@/lib/ai/providers/gemmaClient";
import type { CallTriageAgentInput } from "./types";
import { mockCallTriageAgent } from "./mockCallTriageAgent";

export type CallTriageAgentProvider = "mock" | "gemma" | "featherless";

export type RunCallTriageAgentInput = CallTriageAgentInput & {
  /**
   * When omitted, uses process.env.AI_PROVIDER.
   * Defaults to "mock".
   */
  provider?: CallTriageAgentProvider | string | null;
};

/**
 * Provenance for one triage call. `requested_provider` is what the caller
 * (or AI_PROVIDER) asked for; `used_provider` is what actually produced
 * `output`. They differ when Gemma fails / has no key and we fall back to
 * the deterministic mock — the reason is captured in `provider_error`.
 */
export type TriageProvenance = {
  requested_provider: CallTriageAgentProvider;
  used_provider: CallTriageAgentProvider;
  provider_error: string | null;
};

export type RunCallTriageAgentResult = {
  output: TriageAgentOutput;
} & TriageProvenance;

const normalizeProvider = (
  raw: RunCallTriageAgentInput["provider"]
): CallTriageAgentProvider => {
  const value = (raw ?? process.env.AI_PROVIDER ?? "mock")
    .toString()
    .trim()
    .toLowerCase();

  if (value === "mock" || value === "gemma" || value === "featherless") {
    return value;
  }

  return "mock";
};

const runMockFallback = async (
  input: RunCallTriageAgentInput
): Promise<TriageAgentOutput> => {
  return mockCallTriageAgent(input);
};

/**
 * Lower-level entrypoint that returns provider provenance alongside the
 * triage output. Callers that surface diagnostics (the simulator, audit
 * logs, the dev triage-preview route) should use this so a silent Gemma →
 * mock fallback is observable.
 */
export const runCallTriageAgentWithProvenance = async (
  input: RunCallTriageAgentInput
): Promise<RunCallTriageAgentResult> => {
  const requested_provider = normalizeProvider(input.provider);

  if (requested_provider === "mock") {
    const output = await runMockFallback(input);
    return {
      output,
      requested_provider,
      used_provider: "mock",
      provider_error: null,
    };
  }

  if (requested_provider === "featherless") {
    const apiKey = process.env.FEATHERLESS_API_KEY?.trim();
    const model = process.env.FEATHERLESS_MODEL?.trim();
    if (!apiKey) {
      const output = await runMockFallback(input);
      return {
        output,
        requested_provider,
        used_provider: "mock",
        provider_error:
          "FEATHERLESS_API_KEY is not set; using mock fallback.",
      };
    }
    if (!model) {
      const output = await runMockFallback(input);
      return {
        output,
        requested_provider,
        used_provider: "mock",
        provider_error:
          "FEATHERLESS_MODEL is not set; using mock fallback.",
      };
    }

    try {
      const raw = await generateTriageJsonViaFeatherless(input);
      const output = validateTriageAgentOutput(raw);
      return {
        output,
        requested_provider,
        used_provider: "featherless",
        provider_error: null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Featherless call failed";
      const output = await runMockFallback(input);
      return {
        output,
        requested_provider,
        used_provider: "mock",
        provider_error: message,
      };
    }
  }

  // requested_provider === "gemma"
  const key = process.env.GEMMA_API_KEY?.trim();
  if (!key) {
    const output = await runMockFallback(input);
    return {
      output,
      requested_provider,
      used_provider: "mock",
      provider_error: "GEMMA_API_KEY is not set; using mock fallback.",
    };
  }

  try {
    const raw = await generateTriageJsonViaGemma(input);
    const output = validateTriageAgentOutput(raw);
    return {
      output,
      requested_provider,
      used_provider: "gemma",
      provider_error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gemma call failed";
    const output = await runMockFallback(input);
    return {
      output,
      requested_provider,
      used_provider: "mock",
      provider_error: message,
    };
  }
};

/**
 * Backward-compatible entrypoint kept for callers that only need the
 * `TriageAgentOutput`. New code should prefer
 * `runCallTriageAgentWithProvenance`.
 */
export const runCallTriageAgent = async (
  input: RunCallTriageAgentInput
): Promise<TriageAgentOutput> => {
  const result = await runCallTriageAgentWithProvenance(input);
  return result.output;
};
