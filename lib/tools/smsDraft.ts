/**
 * SMS draft generator. Pure server-side templater — does NOT send SMS;
 * `/api/operator/send-sms` (Member 2) is the only path that talks to a
 * provider, and even that is currently a stub.
 *
 * The output is a short, factual confirmation string the operator (or the
 * Call Triage Agent's second pass) can review before sending.
 */

import { z } from "zod";
import type {
  SmsDraftData,
  ToolExecutionSource,
} from "@/lib/ai/toolResults";

export const smsDraftArgsSchema = z.object({
  incident_id: z.string().min(1),
  language: z.string().min(2).max(8).default("en"),
  summary: z.string().trim().min(1, "summary is required"),
  recommended_action: z.string().optional().nullable(),
  reference_code: z.string().optional().nullable(),
  /**
   * Backward-compatible destination label. Prefer `destination.name`.
   */
  destination_name: z.string().optional().nullable(),
  /**
   * Proposal-aligned destination structure.
   * Only `name` is used for the SMS draft in MVP.
   */
  destination: z
    .object({
      name: z.string().trim().min(1),
    })
    .optional()
    .nullable(),
});

export type SmsDraftArgs = z.infer<typeof smsDraftArgsSchema>;

export type SmsDraftOutput = {
  data: SmsDraftData;
  source: ToolExecutionSource;
};

const truncate = (text: string, max = 140): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

export const smsDraft = async (
  args: SmsDraftArgs
): Promise<SmsDraftOutput> => {
  const reference =
    args.reference_code ?? `INC-${args.incident_id.slice(0, 8).toUpperCase()}`;

  const segments: string[] = [`Report received. Ref: ${reference}.`];

  segments.push(`Summary: ${truncate(args.summary, 100)}`);

  const destinationLabel = args.destination?.name ?? args.destination_name ?? null;
  if (destinationLabel) {
    segments.push(`Nearest help: ${destinationLabel}.`);
  }

  if (args.recommended_action) {
    segments.push(args.recommended_action);
  }

  const message = truncate(segments.join(" "), 300);

  return {
    data: {
      message,
      language: args.language,
      character_count: message.length,
    },
    source: "mock",
  };
};
