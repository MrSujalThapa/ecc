/**
 * Featherless OpenAI-compatible chat completions client for call triage JSON.
 *
 * Base URL and auth match Featherless docs:
 * https://featherless.ai/docs/api-overview-and-common-options
 *
 * On failure, callTriageAgent falls back to mockCallTriageAgent.
 * This module does not run in the browser for production triage paths.
 */

import type { CallTriageAgentInput } from "@/lib/ai/agents/types";
import { buildCallTriageSystemPrompt } from "@/lib/ai/prompts/callTriagePrompt";
import type { AppMode } from "@/lib/types/enums";
import { buildTriageUserMessage, parseModelJsonText } from "./gemmaClient";

export const DEFAULT_FEATHERLESS_API_BASE = "https://api.featherless.ai/v1";

export const FEATHERLESS_REQUEST_TIMEOUT_MS = 28_000;

type FeatherlessChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
  error?: { message?: string };
};

const normalizeApiBase = (raw: string | undefined): string => {
  const trimmed = (raw ?? DEFAULT_FEATHERLESS_API_BASE).trim();
  return trimmed.replace(/\/+$/, "");
};

/**
 * Returns parsed JSON (unknown) for validateTriageAgentOutput downstream.
 */
export const generateTriageJsonViaFeatherless = async (
  input: CallTriageAgentInput
): Promise<unknown> => {
  const key = process.env.FEATHERLESS_API_KEY?.trim();
  const model = process.env.FEATHERLESS_MODEL?.trim();

  if (!key) {
    throw new Error("FEATHERLESS_API_KEY is not set.");
  }
  if (!model) {
    throw new Error("FEATHERLESS_MODEL is not set.");
  }

  const base = normalizeApiBase(process.env.FEATHERLESS_BASE_URL);
  const url = `${base}/chat/completions`;

  const mode: AppMode = (input.mode ?? "normal") as AppMode;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: buildCallTriageSystemPrompt(mode) },
      { role: "user", content: buildTriageUserMessage(input) },
    ],
    temperature: 0.2,
    max_tokens: 4096,
  };

  if (process.env.FEATHERLESS_JSON_RESPONSE === "1") {
    body.response_format = { type: "json_object" };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };

  const referer = process.env.FEATHERLESS_HTTP_REFERER?.trim();
  const title = process.env.FEATHERLESS_X_TITLE?.trim();
  if (referer) {
    headers["HTTP-Referer"] = referer;
  }
  if (title) {
    headers["X-Title"] = title;
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    FEATHERLESS_REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = (await response.json()) as FeatherlessChatCompletionResponse;

    if (!response.ok) {
      throw new Error(
        payload.error?.message ?? `Featherless HTTP ${response.status}`
      );
    }

    const text = payload.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) {
      throw new Error("Featherless returned empty content.");
    }

    return parseModelJsonText(text);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Featherless request timed out.");
    }
    if (error instanceof Error) {
      throw new Error(`Featherless request failed: ${error.message}`);
    }
    throw new Error("Featherless request failed with an unknown error.");
  } finally {
    clearTimeout(timer);
  }
};
