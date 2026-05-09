/**
 * Call Triage Agent input types. Output is `TriageAgentOutput` from
 * `../schemas/triageAgentOutputSchema`.
 *
 * Domain entities live in `@/lib/types`. `IncidentLike` / `CallSessionLike`
 * stay permissive so tests and mocks can pass partial rows before Supabase wiring.
 */

import type { AppMode } from "@/lib/types/enums";
import type { CallSession, Incident } from "@/lib/types/domain";
import type { ToolResult } from "@/lib/ai/toolResults";

export type AgentMode = AppMode;

export type TranscriptLike =
  | string
  | {
      text?: string;
      final_transcript?: string;
      speaker?: string;
      is_final?: boolean;
      language?: string;
      [key: string]: unknown;
    };

export type IncidentLike = Partial<Incident> & Record<string, unknown>;

export type CallSessionLike = Partial<CallSession> & Record<string, unknown>;

export type CallTriageAgentInput = {
  incident?: IncidentLike | null;
  callSession?: CallSessionLike | null;
  latestTranscript: TranscriptLike;
  transcriptHistory?: TranscriptLike[];
  mode?: AgentMode;
  /**
   * Populated by the backend on the second pass of the controlled tool loop
   * (`lib/db/call-repository.ts` → `repositoryCallTurn`). The agent should
   * reason over these results and produce a final patch. On the first pass
   * this is `undefined`.
   */
  toolResults?: ToolResult[];
};
