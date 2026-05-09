import {
  validateTriageAgentOutput,
  type TriageAgentOutput,
} from "../schemas/triageAgentOutputSchema";

export type ControlledAgentFallback = () =>
  | TriageAgentOutput
  | Promise<TriageAgentOutput>;

export type RunControlledAgentOptions = {
  fallback?: ControlledAgentFallback;
};

export class ControlledAgentOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ControlledAgentOutputError";
  }
}

function stripMarkdownFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch?.[1]?.trim() ?? trimmed;
}

function extractBalancedJsonObject(raw: string): string {
  const text = stripMarkdownFence(raw);
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) {
    throw new ControlledAgentOutputError("Model output did not contain JSON.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = firstBrace; i < text.length; i += 1) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(firstBrace, i + 1);
      }
    }
  }

  throw new ControlledAgentOutputError("Model output JSON was incomplete.");
}

function parseModelJson(rawModelText: string): unknown {
  const jsonText = extractBalancedJsonObject(rawModelText);
  try {
    return JSON.parse(jsonText) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ControlledAgentOutputError(`Model output JSON parse failed: ${message}`);
  }
}

export async function runControlledAgent(
  rawModelText: string,
  options: RunControlledAgentOptions = {}
): Promise<TriageAgentOutput> {
  try {
    const parsed = parseModelJson(rawModelText);
    return validateTriageAgentOutput(parsed);
  } catch (error) {
    if (options.fallback) {
      return options.fallback();
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new ControlledAgentOutputError(
      "Model output validation failed with an unknown error."
    );
  }
}
