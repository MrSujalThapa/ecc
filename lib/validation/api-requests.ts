import { z } from "zod";
import { APP_MODES } from "@/lib/types/enums";

export const callStartRequestSchema = z.object({
  mode: z.enum(APP_MODES).optional(),
  twilio_call_sid: z.string().nullable().optional(),
  elevenlabs_conversation_id: z.string().nullable().optional(),
});

export const callTurnRequestSchema = z
  .object({
    incident_id: z.string().min(1),
    call_session_id: z.string().min(1),
    speaker: z.string().min(1),
    text: z.string().optional(),
    final_transcript: z.string().optional(),
    is_final: z.boolean(),
    source: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const body = data.text ?? data.final_transcript ?? "";
    if (body.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide text or final_transcript with non-empty content",
        path: ["text"],
      });
    }
  });

export const callEndRequestSchema = z
  .object({
    incident_id: z.string().min(1),
    call_session_id: z.string().min(1),
    reason: z.string().min(1).optional(),
    outcome: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.reason && !data.outcome) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide reason or outcome",
        path: ["reason"],
      });
    }
  });

export const operatorTakeoverRequestSchema = z.object({
  incident_id: z.string().min(1),
  operator_id: z.string().min(1),
});

const incidentPatchSchema = z
  .object({
    urgency: z.string().optional(),
    incident_type: z.string().optional(),
    status: z.string().optional(),
    assigned_operator: z.string().nullable().optional(),
    control_state: z.string().optional(),
    location_status: z.string().optional(),
    location_confidence: z.number().nullable().optional(),
    location: z.string().nullable().optional(),
    coordinates: z
      .object({ lat: z.number(), lng: z.number() })
      .nullable()
      .optional(),
    summary: z.string().nullable().optional(),
    collected_fields: z.record(z.string(), z.unknown()).optional(),
    missing_fields: z.array(z.string()).optional(),
    custom_fields: z.array(z.record(z.string(), z.unknown())).optional(),
    recommended_action: z.string().nullable().optional(),
    priority_score: z.number().nullable().optional(),
    cluster_id: z.string().nullable().optional(),
  });

export const operatorUpdateIncidentRequestSchema = z.object({
  incident_id: z.string().min(1),
  operator_id: z.string().min(1),
  patch: incidentPatchSchema,
});

export const operatorResolveRequestSchema = z.object({
  incident_id: z.string().min(1),
  operator_id: z.string().min(1),
  resolution_note: z.string().nullable().optional(),
});

export const operatorSendSmsRequestSchema = z.object({
  incident_id: z.string().min(1),
  operator_id: z.string().min(1),
  message: z.string().min(1),
});

export const simulateBatchRequestSchema = z.object({
  /** `0` = wipe only (no new rows). Default seed size when omitted. */
  batch_size: z.number().int().min(0).max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
  /** When true, delete existing incidents (and cascaded rows) before seeding (`docs/api_contracts.md`). */
  reset_existing: z.boolean().optional(),
});

/** Dev-only: dry-run triage (`runCallTriageAgent`) without persisting transcript or patches. */
export const triagePreviewRequestSchema = z.object({
  latest_transcript: z.string().min(1),
  transcript_history: z.array(z.string()).optional(),
  mode: z.enum(APP_MODES).optional(),
  provider: z.string().nullable().optional(),
  incident: z.object({ id: z.string().min(1) }).passthrough(),
  call_session: z.object({ id: z.string().min(1) }).passthrough(),
});
