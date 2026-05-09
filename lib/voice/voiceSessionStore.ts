/**
 * lib/voice/voiceSessionStore.ts
 *
 * In-memory store that maps Twilio call SIDs and ElevenLabs conversation IDs
 * to backend incident/session IDs.
 *
 * Uses module-scope Maps (same pattern as lib/server/demo-store.ts).
 * Safe for hackathon use — the server does not restart between calls in dev/Vercel.
 *
 * This store is Voice/Telephony (M2) territory only.
 * Do not import from lib/db, lib/ai, or dashboard components.
 */

export type VoiceSessionEntry = {
  /** Backend incident UUID. */
  incident_id: string;
  /** Backend call session UUID. */
  call_session_id: string;
  /** The system mode this call started in. */
  mode: string;
  /** ISO timestamp when this entry was created. */
  created_at: string;
};

// Map: twilio_call_sid → session entry
const bySid = new Map<string, VoiceSessionEntry>();

// Map: elevenlabs_conversation_id → session entry
const byElId = new Map<string, VoiceSessionEntry>();

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

/**
 * Register a new voice session after /api/call/start returns IDs.
 * Call this from the Twilio inbound webhook handler.
 */
export const registerVoiceSession = (opts: {
  twilio_call_sid: string;
  incident_id: string;
  call_session_id: string;
  mode?: string;
  elevenlabs_conversation_id?: string | null;
}): void => {
  const entry: VoiceSessionEntry = {
    incident_id: opts.incident_id,
    call_session_id: opts.call_session_id,
    mode: opts.mode ?? "normal",
    created_at: new Date().toISOString(),
  };
  bySid.set(opts.twilio_call_sid, entry);
  if (opts.elevenlabs_conversation_id) {
    byElId.set(opts.elevenlabs_conversation_id, entry);
  }
};

/**
 * Add or update the ElevenLabs conversation ID for an existing session.
 * Call this when ElevenLabs returns the conversation_id (e.g. from its API
 * or from the first webhook event that includes it).
 */
export const updateVoiceSessionElevenLabsId = (
  twilio_call_sid: string,
  elevenlabs_conversation_id: string
): void => {
  const entry = bySid.get(twilio_call_sid);
  if (!entry) return;
  byElId.set(elevenlabs_conversation_id, entry);
};

/**
 * Patch the incident_id and call_session_id on an existing session entry.
 *
 * Used after an async repositoryCallStart resolves: the voice webhook
 * generates temporary local UUIDs so the first LLM turn responds fast,
 * then calls this once Supabase has written the real IDs. From turn 2
 * onwards, repositoryCallTurn will use the correct Supabase IDs so
 * incidents and transcripts persist properly for M1/M4.
 */
export const patchVoiceSessionIds = (
  lookup_key: string,
  real_incident_id: string,
  real_call_session_id: string
): void => {
  // Patch every entry in both maps that matches this lookup key
  const entry = bySid.get(lookup_key) ?? byElId.get(lookup_key);
  if (!entry) return;
  entry.incident_id = real_incident_id;
  entry.call_session_id = real_call_session_id;
  // Because all registered keys share the same object reference, a single
  // mutation updates all lookup paths simultaneously.
};

/**
 * Remove all entries for a Twilio call SID (call ended or failed).
 */
export const removeVoiceSession = (twilio_call_sid: string): void => {
  const entry = bySid.get(twilio_call_sid);
  bySid.delete(twilio_call_sid);
  if (!entry) return;
  // Clean up any elevenlabs IDs pointing to the same session
  for (const [elId, e] of byElId) {
    if (e.call_session_id === entry.call_session_id) {
      byElId.delete(elId);
    }
  }
};

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/** Look up a session by Twilio call SID. */
export const getSessionByTwilioSid = (
  twilio_call_sid: string
): VoiceSessionEntry | undefined => bySid.get(twilio_call_sid);

/** Look up a session by ElevenLabs conversation ID. */
export const getSessionByElevenLabsId = (
  elevenlabs_conversation_id: string
): VoiceSessionEntry | undefined => byElId.get(elevenlabs_conversation_id);

/** Snapshot of current store sizes — useful for logging and tests. */
export const getVoiceStoreSizes = (): { bySid: number; byElId: number } => ({
  bySid: bySid.size,
  byElId: byElId.size,
});
