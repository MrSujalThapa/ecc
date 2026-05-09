/**
 * Google AI Studio / Generative Language API client for Gemma or compatible models.
 *
 * Used as the current real-AI provider for testing/demo.
 * If this provider fails, callTriageAgent falls back to mockCallTriageAgent.
 *
 * This file does not write to the database, does not call Twilio/ElevenLabs/Mapbox,
 * and does not execute emergency actions.
 */

import { buildCallTriageSystemPrompt } from "@/lib/ai/prompts/callTriagePrompt";
import type { CallTriageAgentInput } from "@/lib/ai/agents/types";
import type { AppMode } from "@/lib/types/enums";

export const DEFAULT_GEMMA_MODEL = "gemma-4-26b-a4b-it";

export const GEMMA_REQUEST_TIMEOUT_MS = 28_000;

function extractTranscriptText(
  transcript: CallTriageAgentInput["latestTranscript"]
): string {
  if (typeof transcript === "string") {
    return transcript;
  }

  if (transcript && typeof transcript === "object") {
    if (
      "final_transcript" in transcript &&
      typeof transcript.final_transcript === "string"
    ) {
      return transcript.final_transcript;
    }

    if ("text" in transcript && typeof transcript.text === "string") {
      return transcript.text;
    }
  }

  return "";
}

function extractHistoryLine(
  historyItem: NonNullable<CallTriageAgentInput["transcriptHistory"]>[number]
): string {
  return extractTranscriptText(historyItem);
}

export const buildTriageUserMessage = (
  input: CallTriageAgentInput
): string => {
  const latestTranscript = extractTranscriptText(input.latestTranscript);
  const transcriptHistory = (input.transcriptHistory ?? [])
    .map(extractHistoryLine)
    .filter(Boolean);

  const toolResults = input.toolResults ?? [];

  return [
    "Use the following JSON context. Reply with TriageAgentOutput JSON only.",
    "Do not include markdown fences. Do not include explanation outside JSON.",
    toolResults.length > 0
      ? "Tool results from the backend are included; reason over them and produce final state. Do NOT request the same tools again."
      : "",
    "",
    JSON.stringify(
      {
        mode: input.mode ?? "normal",
        incident: input.incident ?? null,
        call_session: input.callSession ?? null,
        transcript_history: transcriptHistory,
        latest_transcript: latestTranscript,
        tool_results: toolResults,
      },
      null,
      2
    ),
  ]
    .filter(Boolean)
    .join("\n");
};

const stripMarkdownFence = (text: string): string => {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/im.exec(trimmed);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return trimmed;
};

/**
 * Walks the string and returns the substring of the first balanced `{...}`
 * block, ignoring braces inside JSON strings (with backslash escapes).
 *
 * Needed because Gemma models on the Generative Language API don't honor
 * `responseMimeType: "application/json"` and frequently wrap the JSON in
 * markdown / preamble like "Sure, here's the response: { ... }".
 */
const extractFirstJsonObject = (text: string): string | null => {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
};

export const parseModelJsonText = (text: string): unknown => {
  const raw = stripMarkdownFence(text);
  try {
    return JSON.parse(raw) as unknown;
  } catch (initialError) {
    const extracted = extractFirstJsonObject(raw);
    if (extracted) {
      try {
        return JSON.parse(extracted) as unknown;
      } catch {
        // fall through to the original error
      }
    }
    const message =
      initialError instanceof Error ? initialError.message : "parse failed";
    throw new Error(`Model output did not contain valid JSON: ${message}`);
  }
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
  };
};

const VOICE_SYSTEM_PROMPT = `
You are a live emergency dispatch AI. A caller is on the phone right now.
Given the conversation so far, reply with ONE short sentence spoken to the caller.

Rules:
- 1-2 sentences maximum. Calm, clear, direct.
- If this is the first message and you don't know their location yet, ask for it.
- Fire or smoke: tell them to evacuate immediately if safe, say help is coming.
- Break-in or intruder: tell them to stay hidden, help is coming.
- Medical emergency: tell them not to move the person, help is coming.
- Non-emergency (theft, lost item): acknowledge and ask for their location.
- Unknown: ask one short clarifying question.
- Never repeat a question you already asked.
- Reply with ONLY the spoken sentence. No JSON, no labels, no explanation.
`.trim();

/**
 * Lightweight voice-only Gemma call.
 * Returns just the sentence to say to the caller.
 * Uses a minimal prompt with no tool catalog — designed for <1s responses.
 * Throws on any failure so the caller can use voiceFallback.
 */
export const generateVoiceReplyViaGemma = async (
  conversationHistory: string[],
  latestUserText: string
): Promise<string> => {
  const key = process.env.GEMMA_API_KEY?.trim();
  const model = process.env.GEMMA_MODEL?.trim() || DEFAULT_GEMMA_MODEL;

  if (!key) throw new Error("GEMMA_API_KEY is not set.");

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  // Build a simple user message from the full conversation
  const historyLines = conversationHistory.length > 0
    ? `Previous caller messages:\n${conversationHistory.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n`
    : "";
  const userMessage = `${historyLines}Latest caller message: "${latestUserText}"\n\nWhat do you say to the caller?`;

  const body = {
    systemInstruction: { parts: [{ text: VOICE_SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 80 },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMMA_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    if (!response.ok) throw new Error(payload.error?.message ?? `HTTP ${response.status}`);

    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) throw new Error("Empty response from Gemma.");

    return text.trim();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("Gemma voice request timed out.");
    if (error instanceof Error) throw error;
    throw new Error("Gemma voice request failed.");
  } finally {
    clearTimeout(timer);
  }
};

export const generateTriageJsonViaGemma = async (
  input: CallTriageAgentInput
): Promise<unknown> => {
  const key = process.env.GEMMA_API_KEY?.trim();
  const model = process.env.GEMMA_MODEL?.trim() || DEFAULT_GEMMA_MODEL;

  if (!key) {
    throw new Error("GEMMA_API_KEY is not set.");
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const mode: AppMode = (input.mode ?? "normal") as AppMode;
  const body = {
    systemInstruction: {
      parts: [
        {
          text: buildCallTriageSystemPrompt(mode),
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: buildTriageUserMessage(input),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMMA_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = (await response.json()) as GeminiGenerateContentResponse;

    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Gemma HTTP ${response.status}`);
    }

    const text =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("") ?? "";

    if (!text.trim()) {
      throw new Error("Gemma returned empty text.");
    }

    return parseModelJsonText(text);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Gemma request timed out.");
    }

    if (error instanceof Error) {
      throw new Error(`Gemma request failed: ${error.message}`);
    }

    throw new Error("Gemma request failed with an unknown error.");
  } finally {
    clearTimeout(timer);
  }
};