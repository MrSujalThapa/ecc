import type { CallSession } from "@/lib/types/domain";

export const callSessionToDb = (s: CallSession): Record<string, unknown> => ({
  updated_at: s.updated_at,
  twilio_call_sid: s.twilio_call_sid,
  elevenlabs_conversation_id: s.elevenlabs_conversation_id,
  caller_phone: s.caller_phone,
  status: s.status,
  ai_active: s.ai_active,
  turn_count: s.turn_count,
  recent_transcript: s.recent_transcript,
  required_fields: s.required_fields,
  missing_fields: s.missing_fields,
  next_question: s.next_question,
  last_model_confidence: s.last_model_confidence,
  should_escalate: s.should_escalate,
  operator_transfer_status: s.operator_transfer_status,
});

export const newCallSessionInsertRow = (
  id: string,
  incidentId: string,
  t: string,
  opts: {
    twilio_call_sid?: string | null;
    elevenlabs_conversation_id?: string | null;
    caller_phone?: string | null;
  }
): Record<string, unknown> => ({
  id,
  incident_id: incidentId,
  twilio_call_sid: opts.twilio_call_sid ?? null,
  elevenlabs_conversation_id: opts.elevenlabs_conversation_id ?? null,
  caller_phone: opts.caller_phone ?? null,
  status: "active",
  ai_active: true,
  turn_count: 0,
  recent_transcript: [],
  required_fields: [],
  missing_fields: [],
  next_question: null,
  last_model_confidence: null,
  should_escalate: false,
  operator_transfer_status: "not_requested",
  created_at: t,
  updated_at: t,
});
