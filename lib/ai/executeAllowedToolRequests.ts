/**
 * Dispatcher between AI tool requests and backend executors.
 *
 * The Call Triage Agent emits a loose `{ tool, args, reason }` array. This
 * function:
 *  1. Normalizes each entry into a typed `ToolRequest` (assigns an `id` if
 *     missing, looks up the registry entry, infers `safety_level`).
 *  2. Validates `args` against the registry's Zod schema.
 *  3. Rejects unknown tools and tools not allowed in the current mode.
 *  4. Runs the executor with a per-tool timeout.
 *  5. Wraps the result as `ToolResult<T>`.
 *
 * The function NEVER throws for individual tool failures — they become
 * `ToolResult { ok: false, error }` so the second-pass agent can reason
 * about partial success.
 */

import { ZodError } from "zod";
import type { TriageToolRequest } from "@/lib/ai/schemas/triageAgentOutputSchema";
import {
  getToolDefinition,
  isModeAllowed,
  type ToolDefinition,
} from "@/lib/ai/toolRegistry";
import {
  isSafeToolName,
  type SafeToolName,
  type ToolError,
  type ToolErrorCode,
  type ToolRequest,
  type ToolResult,
} from "@/lib/ai/toolResults";
import type { CallSession, Incident } from "@/lib/types/domain";
import type { AppMode } from "@/lib/types/enums";
import { isoNow } from "@/lib/server/iso-now";
import { newId } from "@/lib/server/ids";

export type ExecuteAllowedToolRequestsInput = {
  mode: AppMode;
  incident: Incident;
  callSession: CallSession;
  requests: ReadonlyArray<TriageToolRequest>;
};

export type ExecuteAllowedToolRequestsResult = {
  /** Normalized requests (with server-assigned ids) — useful for audit logs. */
  requests: ToolRequest[];
  results: ToolResult[];
};

const buildError = (
  code: ToolErrorCode,
  message: string,
  details?: unknown
): ToolError => ({ code, message, details });

const normalizeRequest = (
  raw: TriageToolRequest,
  fallbackToolName?: string
): { request: ToolRequest | null; preflightError: ToolError | null } => {
  const id = newId();
  const toolName = (raw.tool ?? fallbackToolName ?? "").trim();
  if (!isSafeToolName(toolName)) {
    return {
      request: null,
      preflightError: buildError(
        "unknown_tool",
        `Unknown or unsupported tool "${toolName}".`
      ),
    };
  }
  return {
    request: {
      id,
      tool: toolName,
      args: raw.args ?? {},
      reason: raw.reason ?? "",
      safety_level: "read_only",
    },
    preflightError: null,
  };
};

const placeholderRejection = (
  raw: TriageToolRequest,
  preflightError: ToolError
): { request: ToolRequest; result: ToolResult } => {
  const id = newId();
  const toolName: SafeToolName = isSafeToolName(raw.tool)
    ? raw.tool
    : "geocode_location";
  const request: ToolRequest = {
    id,
    tool: toolName,
    args: raw.args ?? {},
    reason: raw.reason ?? "",
    safety_level: "read_only",
  };
  return {
    request,
    result: {
      tool_request_id: id,
      tool: toolName,
      ok: false,
      source: "manual",
      error: preflightError,
      created_at: isoNow(),
    },
  };
};

const runWithTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<{ ok: true; value: T } | { ok: false; error: ToolError }> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const value = await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`Tool execution timed out after ${timeoutMs}ms.`)
            ),
          timeoutMs
        );
      }),
    ]);
    return { ok: true, value };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = message.includes("timed out");
    return {
      ok: false,
      error: buildError(
        isTimeout ? "executor_timeout" : "executor_error",
        message
      ),
    };
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
};

const dispatchOne = async (
  raw: TriageToolRequest,
  mode: AppMode
): Promise<{ request: ToolRequest; result: ToolResult }> => {
  const { request, preflightError } = normalizeRequest(raw);
  if (!request || preflightError) {
    return placeholderRejection(
      raw,
      preflightError ??
        buildError("unknown_tool", `Unknown tool "${raw.tool}".`)
    );
  }

  const definition: ToolDefinition | undefined = getToolDefinition(request.tool);
  if (!definition) {
    return {
      request,
      result: {
        tool_request_id: request.id,
        tool: request.tool,
        ok: false,
        source: "manual",
        error: buildError(
          "unknown_tool",
          `Tool "${request.tool}" is not registered.`
        ),
        created_at: isoNow(),
      },
    };
  }

  request.safety_level = definition.safety_level;

  if (!isModeAllowed(definition, mode)) {
    return {
      request,
      result: {
        tool_request_id: request.id,
        tool: request.tool,
        ok: false,
        source: "manual",
        error: buildError(
          "mode_not_allowed",
          `Tool "${request.tool}" is not allowed in mode "${mode}".`
        ),
        created_at: isoNow(),
      },
    };
  }

  const parsed = definition.argsSchema.safeParse(request.args);
  if (!parsed.success) {
    const issues = (parsed.error as ZodError).issues.map((i) => ({
      path: i.path,
      message: i.message,
    }));
    return {
      request,
      result: {
        tool_request_id: request.id,
        tool: request.tool,
        ok: false,
        source: "manual",
        error: buildError(
          "invalid_args",
          `Invalid args for "${request.tool}".`,
          issues
        ),
        created_at: isoNow(),
      },
    };
  }

  const executed = await runWithTimeout(
    definition.executor(parsed.data),
    definition.timeoutMs
  );

  if (!executed.ok) {
    return {
      request,
      result: {
        tool_request_id: request.id,
        tool: request.tool,
        ok: false,
        source: "manual",
        error: executed.error,
        created_at: isoNow(),
      },
    };
  }

  return {
    request,
    result: {
      tool_request_id: request.id,
      tool: request.tool,
      ok: true,
      source: executed.value.source,
      data: executed.value.data,
      created_at: isoNow(),
    },
  };
};

export const executeAllowedToolRequests = async (
  input: ExecuteAllowedToolRequestsInput
): Promise<ExecuteAllowedToolRequestsResult> => {
  const requests: ToolRequest[] = [];
  const results: ToolResult[] = [];

  for (const raw of input.requests) {
    const { request, result } = await dispatchOne(raw, input.mode);
    requests.push(request);
    results.push(result);
  }

  return { requests, results };
};
