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

const MAX_RECENT_TRANSCRIPT_TURNS = 10;

export type VoiceTranscriptHistoryTurn = {
  role: "caller" | "ai" | "operator" | "system";
  text: string;
  created_at: string;
};

/**
 * Incident and call-session fields captured so far — populated after each
 * async repositoryCallTurn resolves so the next voice turn can skip re-asking
 * for already-known info.
 */
export type VoiceTriageState = {
  /** e.g. "fire", "medical", "theft" */
  incident_type?: string | null;
  /** Current urgency from the merged incident state. */
  urgency?: string | null;
  /** Free-text location string the caller gave. */
  location?: string | null;
  /** Current location collection status from the incident state. */
  location_status?: string | null;
  /** Short incident summary from the merged incident state. */
  summary?: string | null;
  /** Incident status from the merged incident state. */
  status?: string | null;
  /** Call-session status from the merged call state. */
  call_status?: string | null;
  /** Incident control state. */
  control_state?: string | null;
  /** Whether the AI is currently active for the call. */
  ai_active?: boolean | null;
  /** Whether the incident requires an operator. */
  operator_required?: boolean | null;
  /** Whether the call session should escalate. */
  should_escalate?: boolean | null;
  /** Transfer status owned by the call session. */
  operator_transfer_status?: string | null;
  /** Backend-selected next question to ask. */
  next_question?: string | null;
  /** Last question the AI asked the caller. */
  last_question?: string | null;
  /** Last caller-facing text returned to ElevenLabs. */
  last_say_to_caller?: string | null;
  /** Bounded recent final turns for live voice memory. */
  recent_transcript_history?: VoiceTranscriptHistoryTurn[] | null;
  /** Back-compat alias for older callers that used transcriptHistory naming. */
  transcriptHistory?: VoiceTranscriptHistoryTurn[] | null;
  /** ISO timestamp of the last triage-state patch. */
  last_updated_at?: string | null;
  /** Fields already confirmed by the triage agent. */
  collected_fields?: Record<string, string> | null;
  /** Fields still needed. */
  missing_fields?: string[] | null;
};

const compactText = (value: string): string =>
  value.replace(/\s+/g, " ").trim().slice(0, 800);

const normalizeTranscriptTurn = (
  turn: VoiceTranscriptHistoryTurn
): VoiceTranscriptHistoryTurn | null => {
  const text = compactText(turn.text);
  if (!text) return null;
  return {
    role: turn.role,
    text,
    created_at: turn.created_at || new Date().toISOString(),
  };
};

const mergeTranscriptHistory = (
  existing: VoiceTranscriptHistoryTurn[] | null | undefined,
  incoming: VoiceTranscriptHistoryTurn[] | null | undefined
): VoiceTranscriptHistoryTurn[] | null | undefined => {
  if (!incoming) return existing;
  const merged = [...(existing ?? [])];
  for (const turn of incoming) {
    const normalized = normalizeTranscriptTurn(turn);
    if (!normalized) continue;
    const last = merged[merged.length - 1];
    if (
      last &&
      last.role === normalized.role &&
      last.text === normalized.text &&
      last.created_at === normalized.created_at
    ) {
      continue;
    }
    merged.push(normalized);
  }
  return merged.slice(-MAX_RECENT_TRANSCRIPT_TURNS);
};

const mergeCollectedFields = (
  existing: Record<string, string> | null | undefined,
  incoming: Record<string, string> | null | undefined
): Record<string, string> | null | undefined => {
  if (!incoming) return existing;
  return { ...(existing ?? {}), ...incoming };
};

const mergeMissingFields = (
  existing: string[] | null | undefined,
  incoming: string[] | null | undefined
): string[] | null | undefined => {
  if (!Array.isArray(incoming)) return existing;
  return [...new Set(incoming.filter((field): field is string => typeof field === "string"))];
};

export type VoiceSessionEntry = {
  /** Backend incident UUID. */
  incident_id: string;
  /** Backend call session UUID. */
  call_session_id: string;
  /** The system mode this call started in. */
  mode: string;
  /** ISO timestamp when this entry was created. */
  created_at: string;
  /**
   * The real Twilio CallSid for this session (CA...).
   * Null for widget/browser sessions with no underlying phone call.
   * Stored here so the ElevenLabs webhook can retrieve it for live call transfer.
   */
  twilio_call_sid: string | null;
  /** Best-known caller phone for this session when telephony provides it. */
  caller_phone?: string | null;
  /**
   * Cached triage state from the last repositoryCallTurn response.
   * Updated async after each turn — used by the next turn's voice prompt
   * so Featherless knows what has already been collected.
   */
  triage_state?: VoiceTriageState;
};

// Map: twilio_call_sid → session entry
const bySid = new Map<string, VoiceSessionEntry>();

// Map: elevenlabs_conversation_id → session entry
const byElId = new Map<string, VoiceSessionEntry>();

const trimCallerPhone = (value: string | null | undefined): string | null => {
  const phone = value?.trim() ?? "";
  return phone.length > 0 ? phone : null;
};

const getSessionEntry = (lookup_key: string): VoiceSessionEntry | undefined =>
  bySid.get(lookup_key) ?? byElId.get(lookup_key);

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
  caller_phone?: string | null;
}): void => {
  // Only store real Twilio SIDs (CA/CF prefix). Fingerprint keys (fp:...) are
  // internal identifiers, not real SIDs — don't expose them as twilio_call_sid.
  const realSid = opts.twilio_call_sid.startsWith("fp:") ? null : opts.twilio_call_sid;
  const entry: VoiceSessionEntry = {
    incident_id: opts.incident_id,
    call_session_id: opts.call_session_id,
    mode: opts.mode ?? "normal",
    created_at: new Date().toISOString(),
    twilio_call_sid: realSid,
    caller_phone: trimCallerPhone(opts.caller_phone),
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
  const entry = getSessionEntry(lookup_key);
  if (!entry) return;
  entry.incident_id = real_incident_id;
  entry.call_session_id = real_call_session_id;
  // Because all registered keys share the same object reference, a single
  // mutation updates all lookup paths simultaneously.
};

export const patchVoiceSessionCallerPhone = (
  lookup_key: string,
  caller_phone: string | null | undefined
): void => {
  const entry = getSessionEntry(lookup_key);
  if (!entry) return;
  const nextPhone = trimCallerPhone(caller_phone);
  const currentPhone = trimCallerPhone(entry.caller_phone);
  if (currentPhone || !nextPhone) return;
  entry.caller_phone = nextPhone;
};

/**
 * Update the cached triage state for a session.
 * Called async after repositoryCallTurn resolves so the NEXT voice turn
 * can inject collected/missing fields into the Featherless prompt.
 *
 * Looks up by any registered key (twilio SID or ElevenLabs conversation ID).
 */
export const patchVoiceTriageState = (
  lookup_key: string,
  state: VoiceTriageState
): void => {
  const entry = getSessionEntry(lookup_key);
  if (!entry) return;
  const current = entry.triage_state;
  const incomingHistory =
    state.recent_transcript_history ?? state.transcriptHistory ?? undefined;
  const mergedHistory = mergeTranscriptHistory(
    current?.recent_transcript_history ?? current?.transcriptHistory,
    incomingHistory
  );

  // Never downgrade operator_transfer_status — once "requested" or a terminal
  // state is set, backend "not_requested" responses must not clear it.
  const currStatus = current?.operator_transfer_status;
  const incomingStatus = state.operator_transfer_status;
  const TERMINAL = new Set(["transferred", "failed"]);
  const preservedTransferStatus =
    currStatus && TERMINAL.has(currStatus)
      ? currStatus // keep terminal states forever
      : currStatus === "requested" && incomingStatus !== "transferred" && incomingStatus !== "failed"
        ? "requested" // hold "requested" until a terminal state arrives
        : incomingStatus ?? currStatus; // normal update or no prior status

  // Merge into existing state so partial updates don't wipe prior data.
  entry.triage_state = {
    ...current,
    ...state,
    operator_transfer_status: preservedTransferStatus,
    collected_fields: mergeCollectedFields(
      current?.collected_fields,
      state.collected_fields
    ),
    missing_fields: mergeMissingFields(current?.missing_fields, state.missing_fields),
    recent_transcript_history: mergedHistory,
    transcriptHistory: mergedHistory,
    last_question: state.last_question ?? current?.last_question,
    last_say_to_caller: state.last_say_to_caller ?? current?.last_say_to_caller,
    last_updated_at: state.last_updated_at ?? new Date().toISOString(),
  };
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

/**
 * Returns the most recently registered real Twilio phone session (non-fingerprint).
 * Used by the ElevenLabs webhook to link itself to a Twilio call when Parameters
 * aren't forwarded — gives us the real CallSid for live transfer.
 * Only returns sessions created within the last 2 minutes.
 */
export const getRecentPhoneSession = (): (VoiceSessionEntry & { sid: string }) | null => {
  const cutoff = Date.now() - 2 * 60 * 1000;
  let best: (VoiceSessionEntry & { sid: string }) | null = null;
  for (const [sid, entry] of bySid) {
    if (sid.startsWith("fp:")) continue;
    if (new Date(entry.created_at).getTime() < cutoff) continue;
    if (!best || new Date(entry.created_at) > new Date(best.created_at)) {
      best = { ...entry, sid };
    }
  }
  return best;
};
