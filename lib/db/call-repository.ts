import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SystemAction,
  TriageAgentOutput,
} from "@/lib/ai/schemas/triageAgentOutputSchema";
import { runSurgeGeoOpsAgent } from "@/lib/ai/agents/surgeGeoOpsAgent";
import {
  runCallTriageAgentWithProvenance,
  type CallTriageAgentProvider,
} from "@/lib/ai/agents/callTriageAgent";
import type { SurgeCluster as GeoOpsSurgeCluster } from "@/lib/ai/schemas/surgeGeoOpsAgentOutputSchema";
import { executeAllowedToolRequests } from "@/lib/ai/executeAllowedToolRequests";
import type {
  GeocodeLocationData,
  ToolRequest,
  ToolResult,
} from "@/lib/ai/toolResults";
import {
  applyCallSessionPatch,
  applyIncidentPatch,
} from "@/lib/server/merge-triage-output";
import { applyTransferGate } from "@/lib/server/transferGate";
import {
  appendSeedTranscriptEvents,
  appendTranscriptEvent,
  createCallSessionForIncident,
  createEmptyIncident,
  findActiveCallSessionForIncident,
  getCallSession,
  getIncident,
  getTranscriptHistoryForSession,
  listAllIncidentsSorted,
  listCallSessionsForIncidentByCreatedDesc,
  listCallSessionsForIncidentSorted,
  newAuditLog,
  resetDemoStore,
  saveCallSession,
  saveIncident,
} from "@/lib/server/demo-store";
import { isoNow } from "@/lib/server/iso-now";
import { newId } from "@/lib/server/ids";
import { getMockResponders } from "@/lib/server/responders-mock-data";
import { mergeSimulatedSurgeRow } from "@/lib/server/simulate-seed-enrichment";
import {
  buildSurgeGeoOpsAgentInput,
  priorityScoreFromSurgeRank,
} from "@/lib/surge/buildSurgeGeoOpsAgentInput";
import { getServiceRoleClient } from "@/lib/supabase/service";
import type {
  CallEndRequest,
  CallStartRequest,
  CallTurnRequest,
  OperatorResolveRequest,
  OperatorSendSmsRequest,
  OperatorSendSmsResponse,
  OperatorTakeoverRequest,
  OperatorUpdateIncidentRequest,
  SimulateDisasterResponse,
  SimulateWorldCupResponse,
  SurgeAnalyzeRequest,
  SurgeAnalyzeResponse,
  TriageTrace,
} from "@/lib/types/api";
import type {
  CallSession,
  Incident,
  SurgeCluster,
  TranscriptEvent,
} from "@/lib/types/domain";
import type { AppMode, OperatorTransferStatus } from "@/lib/types/enums";
import type { Json } from "@/lib/types/json";
import { callSessionToDb, newCallSessionInsertRow } from "./call-session-row";
import { incidentToDb, newIncidentInsertRow } from "./incident-row";
import {
  mapCallSessionRow,
  mapEventLayerRow,
  mapIncidentRow,
  mapTranscriptRow,
} from "./mappers";

const insertAudit = async (
  client: SupabaseClient,
  input: { incident_id: string | null; actor: string; action: string; patch: Json | null }
): Promise<void> => {
  const { error } = await client.from("audit_logs").insert({
    incident_id: input.incident_id,
    actor: input.actor,
    action: input.action,
    patch: input.patch,
  });
  if (error) throw new Error(error.message);
};

// --- Controlled two-pass tool loop for /api/call/turn ---

type TwoPassTriageOutcome = {
  output: TriageAgentOutput;
  passes: number;
  firstPassToolRequests: TriageAgentOutput["tool_requests"];
  normalizedToolRequests: ToolRequest[];
  toolResults: ToolResult[];
  secondPassError: string | null;
  pass1Provider: CallTriageAgentProvider;
  pass1ProviderError: string | null;
  pass2Provider: CallTriageAgentProvider | null;
  pass2ProviderError: string | null;
  requestedProvider: CallTriageAgentProvider;
};

const hydrateIncidentPatchFromToolResults = (
  patch: TriageAgentOutput["incident_patch"],
  toolResults: readonly ToolResult[]
): TriageAgentOutput["incident_patch"] => {
  // Only fill fields the agent omitted. The agent remains the primary source of truth.
  const hasConfidence = patch.location_confidence !== undefined;
  if (hasConfidence) return patch;

  const geocode = toolResults.find(
    (r): r is ToolResult<GeocodeLocationData> =>
      r.tool === "geocode_location" && r.ok
  );
  const confidence = geocode?.data?.confidence;
  if (typeof confidence !== "number") return patch;

  return { ...patch, location_confidence: confidence };
};

/**
 * Runs the Call Triage Agent with a bounded tool loop:
 *
 *   first pass → tool_requests
 *     → executeAllowedToolRequests (validates + runs registered tools)
 *       → second pass with toolResults
 *
 * - When the first pass returns no tool_requests, no second pass runs.
 * - The loop is capped at 2 model calls. Any tool_requests from the second
 *   pass are kept on the output but ignored (the dispatcher does not run a
 *   third pass).
 * - On second-pass failure (provider/timeout/etc.), the first-pass output is
 *   returned and the error is reported back via `secondPassError`.
 */
const runTriageWithToolLoop = async (input: {
  incident: Incident;
  callSession: CallSession;
  latestTranscript: string;
  transcriptHistory: string[];
  mode: AppMode;
  provider?: string | null;
}): Promise<TwoPassTriageOutcome> => {
  const firstPass = await runCallTriageAgentWithProvenance({
    incident: input.incident,
    callSession: input.callSession,
    latestTranscript: input.latestTranscript,
    transcriptHistory: input.transcriptHistory,
    mode: input.mode,
    provider: input.provider,
  });

  const requestedProvider = firstPass.requested_provider;

  if (firstPass.output.tool_requests.length === 0) {
    return {
      output: firstPass.output,
      passes: 1,
      firstPassToolRequests: firstPass.output.tool_requests,
      normalizedToolRequests: [],
      toolResults: [],
      secondPassError: null,
      pass1Provider: firstPass.used_provider,
      pass1ProviderError: firstPass.provider_error,
      pass2Provider: null,
      pass2ProviderError: null,
      requestedProvider,
    };
  }

  const { requests: normalizedToolRequests, results: toolResults } =
    await executeAllowedToolRequests({
      mode: input.mode,
      incident: input.incident,
      callSession: input.callSession,
      requests: firstPass.output.tool_requests,
    });

  try {
    const secondPass = await runCallTriageAgentWithProvenance({
      incident: input.incident,
      callSession: input.callSession,
      latestTranscript: input.latestTranscript,
      transcriptHistory: input.transcriptHistory,
      mode: input.mode,
      provider: input.provider,
      toolResults,
    });
    return {
      output: secondPass.output,
      passes: 2,
      firstPassToolRequests: firstPass.output.tool_requests,
      normalizedToolRequests,
      toolResults,
      secondPassError: null,
      pass1Provider: firstPass.used_provider,
      pass1ProviderError: firstPass.provider_error,
      pass2Provider: secondPass.used_provider,
      pass2ProviderError: secondPass.provider_error,
      requestedProvider,
    };
  } catch (error) {
    return {
      output: firstPass.output,
      passes: 1,
      firstPassToolRequests: firstPass.output.tool_requests,
      normalizedToolRequests,
      toolResults,
      secondPassError:
        error instanceof Error ? error.message : "second pass failed",
      pass1Provider: firstPass.used_provider,
      pass1ProviderError: firstPass.provider_error,
      pass2Provider: null,
      pass2ProviderError: null,
      requestedProvider,
    };
  }
};

const buildTriageAuditPatch = (
  source: string | undefined,
  outcome: TwoPassTriageOutcome
): Json =>
  JSON.parse(
    JSON.stringify({
      source: source ?? "unknown",
      passes: outcome.passes,
      first_pass_tool_requests: outcome.firstPassToolRequests,
      normalized_tool_requests: outcome.normalizedToolRequests,
      tool_results: outcome.toolResults,
      system_actions: outcome.output.system_actions,
      second_pass_error: outcome.secondPassError,
      requested_provider: outcome.requestedProvider,
      pass1_provider: outcome.pass1Provider,
      pass1_provider_error: outcome.pass1ProviderError,
      pass2_provider: outcome.pass2Provider,
      pass2_provider_error: outcome.pass2ProviderError,
    })
  ) as Json;

const buildTriageTrace = (outcome: TwoPassTriageOutcome): TriageTrace => ({
  passes: outcome.passes,
  first_pass_tool_requests: outcome.firstPassToolRequests,
  normalized_tool_requests: outcome.normalizedToolRequests,
  tool_results: outcome.toolResults,
  second_pass_error: outcome.secondPassError,
  requested_provider: outcome.requestedProvider,
  pass1_provider: outcome.pass1Provider,
  pass1_provider_error: outcome.pass1ProviderError,
  pass2_provider: outcome.pass2Provider,
  pass2_provider_error: outcome.pass2ProviderError,
});

const applyTriagePatchesAndGate = (
  incident: Incident,
  session: CallSession,
  triageOutcome: TwoPassTriageOutcome
) => {
  const aiOutput = triageOutcome.output;
  const incidentPatch = hydrateIncidentPatchFromToolResults(
    aiOutput.incident_patch,
    triageOutcome.toolResults
  );
  const patchedIncident = applyIncidentPatch(incident, incidentPatch);
  const patchedSession = applyCallSessionPatch(session, aiOutput.call_session_patch);
  return applyTransferGate(patchedIncident, patchedSession, aiOutput.system_actions);
};

const appendTransferGateAudits = async (
  client: SupabaseClient | null,
  incident_id: string,
  call_session_id: string,
  gated: ReturnType<typeof applyTransferGate>
): Promise<void> => {
  if (gated.transferApproved) {
    if (client) {
      await insertAudit(client, {
        incident_id,
        actor: "system",
        action: "transfer_requested",
        patch: { call_session_id } as Json,
      });
    } else {
      newAuditLog({
        incident_id,
        actor: "system",
        action: "transfer_requested",
        patch: { call_session_id },
      });
    }
    return;
  }
  if (gated.suppressionReason && gated.hadOperatorTransferIntent) {
    if (client) {
      await insertAudit(client, {
        incident_id,
        actor: "system",
        action: "transfer_suppressed",
        patch: {
          call_session_id,
          reason: gated.suppressionReason,
        } as Json,
      });
    } else {
      newAuditLog({
        incident_id,
        actor: "system",
        action: "transfer_suppressed",
        patch: { call_session_id, reason: gated.suppressionReason },
      });
    }
  }
};

// --- dev: list incidents (Supabase or in-memory) ---

export const repositoryListIncidentsForDev = async (
  limit = 50
): Promise<Incident[]> => {
  const cap = Math.min(Math.max(1, limit), 200);
  const client = getServiceRoleClient();
  if (!client) {
    return listAllIncidentsSorted().slice(0, cap);
  }
  const { data, error } = await client
    .from("incidents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(cap);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapIncidentRow(r as Record<string, unknown>));
};

// --- dev: list call_sessions for one incident ---

export const repositoryListCallSessionsForDev = async (
  incident_id: string
): Promise<CallSession[]> => {
  const client = getServiceRoleClient();
  if (!client) {
    return listCallSessionsForIncidentSorted(incident_id);
  }
  const { data, error } = await client
    .from("call_sessions")
    .select("*")
    .eq("incident_id", incident_id)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapCallSessionRow(r as Record<string, unknown>));
};

// --- call / start ---

export const repositoryCallStart = async (
  parsed: CallStartRequest
): Promise<{
  incident_id: string;
  call_session_id: string;
  incident: Incident;
  call_session: CallSession;
}> => {
  const client = getServiceRoleClient();
  const mode: AppMode = parsed.mode ?? "normal";
  if (!client) {
    const incident = createEmptyIncident(mode);
    const session = createCallSessionForIncident(incident, {
      twilio_call_sid: parsed.twilio_call_sid ?? null,
      elevenlabs_conversation_id: parsed.elevenlabs_conversation_id ?? null,
      caller_phone: parsed.caller_phone ?? null,
    });
    newAuditLog({
      incident_id: incident.id,
      actor: "api",
      action: "call_start",
      patch: { call_session_id: session.id },
    });
    return {
      incident_id: incident.id,
      call_session_id: session.id,
      incident,
      call_session: session,
    };
  }

  const id = newId();
  const sid = newId();
  const t = isoNow();
  const iRow = newIncidentInsertRow(id, mode, t);
  const { data: ins, error: iErr } = await client
    .from("incidents")
    .insert(iRow)
    .select("*")
    .single();
  if (iErr || !ins) throw new Error(iErr?.message ?? "insert incident failed");
  const incident = mapIncidentRow(ins as Record<string, unknown>);

  const sRow = newCallSessionInsertRow(sid, id, t, {
    twilio_call_sid: parsed.twilio_call_sid ?? null,
    elevenlabs_conversation_id: parsed.elevenlabs_conversation_id ?? null,
    caller_phone: parsed.caller_phone ?? null,
  });
  const { data: sess, error: sErr } = await client
    .from("call_sessions")
    .insert(sRow)
    .select("*")
    .single();
  if (sErr || !sess) throw new Error(sErr?.message ?? "insert call_session failed");
  const call_session = mapCallSessionRow(sess as Record<string, unknown>);

  await insertAudit(client, {
    incident_id: id,
    actor: "api",
    action: "call_start",
    patch: { call_session_id: sid },
  });

  return {
    incident_id: id,
    call_session_id: sid,
    incident,
    call_session,
  };
};

// --- call / turn ---

/** Matches `LiveTranscriptPanel` styling for non-caller lines. */
const AI_TRANSCRIPT_SPEAKER = "ai" as const;

const appendTranscriptSupabase = async (
  client: SupabaseClient,
  input: {
    incident_id: string;
    call_session_id: string;
    speaker: string;
    text: string;
    is_final: boolean;
    language: string | null;
    translated_text: string | null;
  }
): Promise<TranscriptEvent> => {
  const tid = newId();
  const created_at = isoNow();
  const { data: tr, error: tErr } = await client
    .from("transcript_events")
    .insert({
      id: tid,
      incident_id: input.incident_id,
      call_session_id: input.call_session_id,
      speaker: input.speaker,
      text: input.text,
      is_final: input.is_final,
      language: input.language,
      translated_text: input.translated_text,
      created_at,
    })
    .select("*")
    .single();
  if (tErr || !tr) throw new Error(tErr?.message ?? "insert transcript failed");
  const event = mapTranscriptRow(tr as Record<string, unknown>);

  const { data: sessionRow, error: gErr } = await client
    .from("call_sessions")
    .select("*")
    .eq("id", input.call_session_id)
    .single();
  if (gErr || !sessionRow) throw new Error(gErr?.message ?? "load session failed");
  const session = mapCallSessionRow(sessionRow as Record<string, unknown>);
  const snippet: Json = {
    speaker: input.speaker,
    text: input.text,
    is_final: input.is_final,
    created_at,
  };
  const recent = [...session.recent_transcript, snippet].slice(-50);
  const { error: uErr } = await client
    .from("call_sessions")
    .update({
      recent_transcript: recent,
      updated_at: isoNow(),
    })
    .eq("id", input.call_session_id);
  if (uErr) throw new Error(uErr.message);

  return event;
};

const listTranscriptTextsSupabase = async (
  client: SupabaseClient,
  callSessionId: string,
  excludeId?: string
): Promise<string[]> => {
  const { data, error } = await client
    .from("transcript_events")
    .select("*")
    .eq("call_session_id", callSessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r) => mapTranscriptRow(r as Record<string, unknown>))
    .filter((e) => (excludeId ? e.id !== excludeId : true))
    .map((e) => e.text);
};

export const repositoryCallTurn = async (
  parsed: CallTurnRequest
): Promise<{
  say_to_caller: string | null;
  incident: Incident;
  call_session: CallSession;
  transcript_event: TranscriptEvent;
  actions: SystemAction[];
  triage_trace: TriageTrace | null;
}> => {
  const text = (parsed.text ?? parsed.final_transcript ?? "").trim();
  const {
    incident_id,
    call_session_id,
    speaker,
    is_final,
    source,
    language,
    translated_text,
  } = parsed;

  const client = getServiceRoleClient();
  if (!client) {
    const incident = getIncident(incident_id);
    const session = getCallSession(call_session_id);
    if (!incident || !session) {
      throw new Error("NOT_FOUND");
    }
    if (session.incident_id !== incident.id) {
      throw new Error("SESSION_MISMATCH");
    }
    if (session.status !== "active") {
      throw new Error("SESSION_INACTIVE");
    }
    const transcriptEvent: TranscriptEvent = {
      id: newId(),
      incident_id,
      call_session_id,
      speaker,
      text,
      is_final,
      language: language ?? null,
      translated_text: translated_text ?? null,
      created_at: isoNow(),
    };
    appendTranscriptEvent(transcriptEvent);
    const refreshedSession = getCallSession(call_session_id);
    if (!refreshedSession) throw new Error("SESSION_MISSING");
    if (!is_final) {
      return {
        say_to_caller:
          refreshedSession.next_question ??
          "Please continue when you are ready.",
        incident: getIncident(incident_id)!,
        call_session: refreshedSession,
        transcript_event: transcriptEvent,
        actions: [],
        triage_trace: null,
      };
    }
    const history = getTranscriptHistoryForSession(call_session_id)
      .filter((e) => e.id !== transcriptEvent.id)
      .map((e) => e.text);
    const triageOutcome = await runTriageWithToolLoop({
      incident,
      callSession: refreshedSession,
      latestTranscript: text,
      transcriptHistory: history,
      mode: incident.mode,
      provider: process.env.AI_PROVIDER,
    });
    const aiOutput = triageOutcome.output;
    const gated = applyTriagePatchesAndGate(incident, refreshedSession, triageOutcome);
    saveIncident(gated.incident);
    saveCallSession(gated.call_session);
    newAuditLog({
      incident_id: incident.id,
      actor: "triage_agent",
      action: "call_turn_final",
      patch: buildTriageAuditPatch(source, triageOutcome),
    });
    await appendTransferGateAudits(null, incident.id, call_session_id, gated);
    const agentText = (aiOutput.say_to_caller ?? "").trim();
    if (agentText) {
      appendTranscriptEvent({
        id: newId(),
        incident_id,
        call_session_id,
        speaker: AI_TRANSCRIPT_SPEAKER,
        text: agentText,
        is_final: true,
        language: null,
        translated_text: null,
        created_at: isoNow(),
      });
    }
    return {
      say_to_caller: aiOutput.say_to_caller,
      incident: getIncident(incident_id)!,
      call_session: getCallSession(call_session_id)!,
      transcript_event: transcriptEvent,
      actions: gated.actions,
      triage_trace: buildTriageTrace(triageOutcome),
    };
  }

  const { data: incRow, error: iErr } = await client
    .from("incidents")
    .select("*")
    .eq("id", incident_id)
    .single();
  if (iErr || !incRow) throw new Error("NOT_FOUND");
  const incident = mapIncidentRow(incRow as Record<string, unknown>);

  const { data: sesRow, error: sErr } = await client
    .from("call_sessions")
    .select("*")
    .eq("id", call_session_id)
    .single();
  if (sErr || !sesRow) throw new Error("NOT_FOUND");
  let session = mapCallSessionRow(sesRow as Record<string, unknown>);

  if (session.incident_id !== incident.id) throw new Error("SESSION_MISMATCH");
  if (session.status !== "active") throw new Error("SESSION_INACTIVE");

  const transcript_event = await appendTranscriptSupabase(client, {
    incident_id,
    call_session_id,
    speaker,
    text,
    is_final,
    language: language ?? null,
    translated_text: translated_text ?? null,
  });

  const { data: ses2 } = await client
    .from("call_sessions")
    .select("*")
    .eq("id", call_session_id)
    .single();
  if (!ses2) throw new Error("SESSION_MISSING");
  session = mapCallSessionRow(ses2 as Record<string, unknown>);

  if (!is_final) {
    return {
      say_to_caller:
        session.next_question ?? "Please continue when you are ready.",
      incident,
      call_session: session,
      transcript_event,
      actions: [],
      triage_trace: null,
    };
  }

  const history = await listTranscriptTextsSupabase(
    client,
    call_session_id,
    transcript_event.id
  );
  const triageOutcome = await runTriageWithToolLoop({
    incident,
    callSession: session,
    latestTranscript: text,
    transcriptHistory: history,
    mode: incident.mode,
    provider: process.env.AI_PROVIDER,
  });
  const aiOutput = triageOutcome.output;
  const gated = applyTriagePatchesAndGate(incident, session, triageOutcome);

  const { error: upI } = await client
    .from("incidents")
    .update(incidentToDb(gated.incident))
    .eq("id", incident_id);
  if (upI) throw new Error(upI.message);
  const { error: upS } = await client
    .from("call_sessions")
    .update(callSessionToDb(gated.call_session))
    .eq("id", call_session_id);
  if (upS) throw new Error(upS.message);

  await insertAudit(client, {
    incident_id,
    actor: "triage_agent",
    action: "call_turn_final",
    patch: buildTriageAuditPatch(source, triageOutcome),
  });
  await appendTransferGateAudits(client, incident_id, call_session_id, gated);

  const agentText = (aiOutput.say_to_caller ?? "").trim();
  if (agentText) {
    await appendTranscriptSupabase(client, {
      incident_id,
      call_session_id,
      speaker: AI_TRANSCRIPT_SPEAKER,
      text: agentText,
      is_final: true,
      language: null,
      translated_text: null,
    });
  }

  const { data: fi } = await client
    .from("incidents")
    .select("*")
    .eq("id", incident_id)
    .single();
  const { data: fs } = await client
    .from("call_sessions")
    .select("*")
    .eq("id", call_session_id)
    .single();
  if (!fi || !fs) throw new Error("reload failed");

  return {
    say_to_caller: aiOutput.say_to_caller,
    incident: mapIncidentRow(fi as Record<string, unknown>),
    call_session: mapCallSessionRow(fs as Record<string, unknown>),
    transcript_event,
    actions: gated.actions,
    triage_trace: buildTriageTrace(triageOutcome),
  };
};

// --- Twilio operator bridge (transfer lifecycle) ---

export const repositoryMarkTransferBridging = async (parsed: {
  incident_id: string;
  call_session_id: string;
}): Promise<void> => {
  const { incident_id, call_session_id } = parsed;
  const client = getServiceRoleClient();
  const t = isoNow();

  if (!client) {
    const session = getCallSession(call_session_id);
    if (!session || session.incident_id !== incident_id) return;
    if (session.status !== "active") return;
    saveCallSession({
      ...session,
      operator_transfer_status: "transferring",
      updated_at: t,
    });
    newAuditLog({
      incident_id,
      actor: "voice",
      action: "transfer_bridging",
      patch: { call_session_id },
    });
    return;
  }

  const { data: sesRow, error: sErr } = await client
    .from("call_sessions")
    .select("*")
    .eq("id", call_session_id)
    .single();
  if (sErr || !sesRow) return;
  const session = mapCallSessionRow(sesRow as Record<string, unknown>);
  if (session.incident_id !== incident_id || session.status !== "active") return;

  const next: CallSession = {
    ...session,
    operator_transfer_status: "transferring",
    updated_at: t,
  };
  const { error: uErr } = await client
    .from("call_sessions")
    .update(callSessionToDb(next))
    .eq("id", call_session_id);
  if (uErr) throw new Error(uErr.message);

  await insertAudit(client, {
    incident_id,
    actor: "voice",
    action: "transfer_bridging",
    patch: { call_session_id } as Json,
  });
};

export const repositoryMarkTransferFailed = async (parsed: {
  incident_id: string;
  call_session_id: string;
  error_message?: string;
}): Promise<void> => {
  const { incident_id, call_session_id, error_message } = parsed;
  const client = getServiceRoleClient();
  const t = isoNow();

  if (!client) {
    const incident = getIncident(incident_id);
    const session = getCallSession(call_session_id);
    if (!incident || !session) return;
    let nextIncident = incident;
    if (incident.status === "transferring_to_operator") {
      nextIncident = {
        ...incident,
        status: "active_call",
        control_state: "ai_leading",
        updated_at: t,
        last_updated_by: "system:transfer_failed",
      };
      saveIncident(nextIncident);
    }
    saveCallSession({
      ...session,
      operator_transfer_status: "failed",
      should_escalate: false,
      updated_at: t,
    });
    newAuditLog({
      incident_id,
      actor: "voice",
      action: "transfer_failed",
      patch: { call_session_id, error: error_message ?? null },
    });
    return;
  }

  const { data: incRow } = await client
    .from("incidents")
    .select("*")
    .eq("id", incident_id)
    .single();
  const { data: sesRow } = await client
    .from("call_sessions")
    .select("*")
    .eq("id", call_session_id)
    .single();
  if (!incRow || !sesRow) return;
  const incident = mapIncidentRow(incRow as Record<string, unknown>);
  const session = mapCallSessionRow(sesRow as Record<string, unknown>);

  if (incident.status === "transferring_to_operator") {
    const rolledBack: Incident = {
      ...incident,
      status: "active_call",
      control_state: "ai_leading",
      updated_at: t,
      last_updated_by: "system:transfer_failed",
    };
    const { error: ie } = await client
      .from("incidents")
      .update(incidentToDb(rolledBack))
      .eq("id", incident_id);
    if (ie) throw new Error(ie.message);
  }

  const nextSession: CallSession = {
    ...session,
    operator_transfer_status: "failed",
    should_escalate: false,
    updated_at: t,
  };
  const { error: se } = await client
    .from("call_sessions")
    .update(callSessionToDb(nextSession))
    .eq("id", call_session_id);
  if (se) throw new Error(se.message);

  await insertAudit(client, {
    incident_id,
    actor: "voice",
    action: "transfer_failed",
    patch: { call_session_id, error: error_message ?? null } as Json,
  });
};

export const repositoryLogTransferCompleted = async (parsed: {
  incident_id: string;
  call_session_id: string;
}): Promise<void> => {
  const { incident_id, call_session_id } = parsed;
  const client = getServiceRoleClient();
  if (!client) {
    newAuditLog({
      incident_id,
      actor: "voice",
      action: "transfer_completed",
      patch: { call_session_id },
    });
    return;
  }
  await insertAudit(client, {
    incident_id,
    actor: "voice",
    action: "transfer_completed",
    patch: { call_session_id } as Json,
  });
};

// --- call / end ---

const mapReasonToStatus = (reason: string): string => {
  if (reason === "completed") return "resolved";
  if (reason === "abandoned") return "abandoned";
  if (reason === "transferred") return "human_active";
  if (reason === "operator_closed") return "resolved";
  return `ended_${reason}`;
};

export const repositoryCallEnd = async (
  parsed: CallEndRequest
): Promise<{ incident: Incident; call_session: CallSession }> => {
  const reason =
    parsed.reason ?? parsed.outcome ?? "completed";
  const { incident_id, call_session_id } = parsed;
  const client = getServiceRoleClient();
  const t = isoNow();

  if (!client) {
    const incident = getIncident(incident_id);
    const session = getCallSession(call_session_id);
    if (!incident || !session) throw new Error("NOT_FOUND");
    if (session.incident_id !== incident.id) throw new Error("SESSION_MISMATCH");
    const nextSession: CallSession = {
      ...session,
      status: "closed",
      ai_active: false,
      updated_at: t,
    };
    saveCallSession(nextSession);
    const nextIncident: Incident = {
      ...incident,
      status: mapReasonToStatus(reason),
      ai_active: false,
      updated_at: t,
      last_updated_by: "api_call_end",
    };
    saveIncident(nextIncident);
    newAuditLog({
      incident_id,
      actor: "api",
      action: "call_end",
      patch: { reason, call_session_id },
    });
    return { incident: nextIncident, call_session: nextSession };
  }

  const { data: incRow } = await client
    .from("incidents")
    .select("*")
    .eq("id", incident_id)
    .single();
  const { data: sesRow } = await client
    .from("call_sessions")
    .select("*")
    .eq("id", call_session_id)
    .single();
  if (!incRow || !sesRow) throw new Error("NOT_FOUND");
  const incident = mapIncidentRow(incRow as Record<string, unknown>);
  const session = mapCallSessionRow(sesRow as Record<string, unknown>);
  if (session.incident_id !== incident.id) throw new Error("SESSION_MISMATCH");

  const nextSession: CallSession = {
    ...session,
    status: "closed",
    ai_active: false,
    updated_at: t,
  };
  const nextIncident: Incident = {
    ...incident,
    status: mapReasonToStatus(reason),
    ai_active: false,
    updated_at: t,
    last_updated_by: "api_call_end",
  };
  const { error: e1 } = await client
    .from("call_sessions")
    .update(callSessionToDb(nextSession))
    .eq("id", call_session_id);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await client
    .from("incidents")
    .update(incidentToDb(nextIncident))
    .eq("id", incident_id);
  if (e2) throw new Error(e2.message);
  await insertAudit(client, {
    incident_id,
    actor: "api",
    action: "call_end",
    patch: { reason, call_session_id },
  });
  return { incident: nextIncident, call_session: nextSession };
};

// --- operator takeover ---

export const repositoryOperatorTakeover = async (
  parsed: OperatorTakeoverRequest
): Promise<{
  incident: Incident;
  call_session: CallSession | null;
  transfer_status: OperatorTransferStatus;
}> => {
  const { incident_id, operator_id } = parsed;
  const client = getServiceRoleClient();
  const t = isoNow();

  if (!client) {
    const incident = getIncident(incident_id);
    if (!incident) throw new Error("NOT_FOUND");
    const active = findActiveCallSessionForIncident(incident_id);
    let closed: CallSession | null = null;
    if (active) {
      const transferDone =
        active.operator_transfer_status === "requested" ||
        active.operator_transfer_status === "transferring";
      closed = {
        ...active,
        status: "closed",
        ai_active: false,
        operator_transfer_status: transferDone ? "transferred" : active.operator_transfer_status,
        updated_at: t,
      };
      saveCallSession(closed);
    }
    const next: Incident = {
      ...incident,
      status: "human_active",
      control_state: "human_active",
      ai_active: false,
      assigned_operator: operator_id,
      updated_at: t,
      last_updated_by: `operator:${operator_id}`,
    };
    saveIncident(next);
    newAuditLog({
      incident_id,
      actor: `operator:${operator_id}`,
      action: "takeover",
      patch: { had_active_session: Boolean(active) },
    });
    return {
      incident: next,
      call_session: closed,
      transfer_status: "not_requested",
    };
  }

  const { data: incRow } = await client
    .from("incidents")
    .select("*")
    .eq("id", incident_id)
    .single();
  if (!incRow) throw new Error("NOT_FOUND");
  const incident = mapIncidentRow(incRow as Record<string, unknown>);

  const { data: activeRows } = await client
    .from("call_sessions")
    .select("*")
    .eq("incident_id", incident_id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);
  const active = activeRows?.[0]
    ? mapCallSessionRow(activeRows[0] as Record<string, unknown>)
    : null;

  let closedSession: CallSession | null = null;
  if (active) {
    const transferDone =
      active.operator_transfer_status === "requested" ||
      active.operator_transfer_status === "transferring";
    closedSession = {
      ...active,
      status: "closed",
      ai_active: false,
      operator_transfer_status: transferDone ? "transferred" : active.operator_transfer_status,
      updated_at: t,
    };
    const { error: ce } = await client
      .from("call_sessions")
      .update(callSessionToDb(closedSession))
      .eq("id", active.id);
    if (ce) throw new Error(ce.message);
  }

  const next: Incident = {
    ...incident,
    status: "human_active",
    control_state: "human_active",
    ai_active: false,
    assigned_operator: operator_id,
    updated_at: t,
    last_updated_by: `operator:${operator_id}`,
  };
  const { error: ie } = await client
    .from("incidents")
    .update(incidentToDb(next))
    .eq("id", incident_id);
  if (ie) throw new Error(ie.message);

  await insertAudit(client, {
    incident_id,
    actor: `operator:${operator_id}`,
    action: "takeover",
    patch: { had_active_session: Boolean(active) },
  });

  return {
    incident: next,
    call_session: closedSession,
    transfer_status: "not_requested",
  };
};

// --- operator update ---

export const repositoryOperatorUpdateIncident = async (
  parsed: OperatorUpdateIncidentRequest
): Promise<{ incident: Incident }> => {
  const client = getServiceRoleClient();
  if (!client) {
    const incident = getIncident(parsed.incident_id);
    if (!incident) throw new Error("NOT_FOUND");
    const merged: Incident = {
      ...incident,
      ...parsed.patch,
      collected_fields: parsed.patch.collected_fields
        ? { ...incident.collected_fields, ...parsed.patch.collected_fields }
        : incident.collected_fields,
      missing_fields: parsed.patch.missing_fields ?? incident.missing_fields,
      updated_at: isoNow(),
      last_updated_by: `operator:${parsed.operator_id}`,
    };
    saveIncident(merged);
    newAuditLog({
      incident_id: parsed.incident_id,
      actor: `operator:${parsed.operator_id}`,
      action: "update_incident",
      patch: parsed.patch as unknown as Json,
    });
    return { incident: merged };
  }
  const { data: row } = await client
    .from("incidents")
    .select("*")
    .eq("id", parsed.incident_id)
    .single();
  if (!row) throw new Error("NOT_FOUND");
  const base = mapIncidentRow(row as Record<string, unknown>);
  const merged: Incident = {
    ...base,
    ...parsed.patch,
    collected_fields: parsed.patch.collected_fields
      ? { ...base.collected_fields, ...parsed.patch.collected_fields }
      : base.collected_fields,
    missing_fields: parsed.patch.missing_fields ?? base.missing_fields,
    updated_at: isoNow(),
    last_updated_by: `operator:${parsed.operator_id}`,
  };
  const { error } = await client
    .from("incidents")
    .update(incidentToDb(merged))
    .eq("id", parsed.incident_id);
  if (error) throw new Error(error.message);
  await insertAudit(client, {
    incident_id: parsed.incident_id,
    actor: `operator:${parsed.operator_id}`,
    action: "update_incident",
    patch: parsed.patch as unknown as Json,
  });
  return { incident: merged };
};

// --- operator resolve ---

export const repositoryOperatorResolve = async (
  parsed: OperatorResolveRequest
): Promise<{ incident: Incident; call_session: CallSession | null }> => {
  const client = getServiceRoleClient();
  const t = isoNow();
  if (!client) {
    const incident = getIncident(parsed.incident_id);
    if (!incident) throw new Error("NOT_FOUND");
    const active = findActiveCallSessionForIncident(parsed.incident_id);
    let closed: CallSession | null = null;
    if (active) {
      closed = { ...active, status: "closed", ai_active: false, updated_at: t };
      saveCallSession(closed);
    }
    const next: Incident = {
      ...incident,
      status: "resolved",
      ai_active: false,
      control_state: "human_active",
      updated_at: t,
      last_updated_by: `operator:${parsed.operator_id}`,
      recommended_action:
        parsed.resolution_note ?? incident.recommended_action,
    };
    saveIncident(next);
    newAuditLog({
      incident_id: parsed.incident_id,
      actor: `operator:${parsed.operator_id}`,
      action: "resolve",
      patch: { note: parsed.resolution_note ?? null },
    });
    return { incident: next, call_session: closed };
  }

  const { data: incRow } = await client
    .from("incidents")
    .select("*")
    .eq("id", parsed.incident_id)
    .single();
  if (!incRow) throw new Error("NOT_FOUND");
  const incident = mapIncidentRow(incRow as Record<string, unknown>);

  const { data: activeRows } = await client
    .from("call_sessions")
    .select("*")
    .eq("incident_id", parsed.incident_id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);
  const active = activeRows?.[0]
    ? mapCallSessionRow(activeRows[0] as Record<string, unknown>)
    : null;

  let closed: CallSession | null = null;
  if (active) {
    closed = { ...active, status: "closed", ai_active: false, updated_at: t };
    const { error } = await client
      .from("call_sessions")
      .update(callSessionToDb(closed))
      .eq("id", active.id);
    if (error) throw new Error(error.message);
  }

  const next: Incident = {
    ...incident,
    status: "resolved",
    ai_active: false,
    control_state: "human_active",
    updated_at: t,
    last_updated_by: `operator:${parsed.operator_id}`,
    recommended_action:
      parsed.resolution_note ?? incident.recommended_action,
  };
  const { error: ie } = await client
    .from("incidents")
    .update(incidentToDb(next))
    .eq("id", parsed.incident_id);
  if (ie) throw new Error(ie.message);
  await insertAudit(client, {
    incident_id: parsed.incident_id,
    actor: `operator:${parsed.operator_id}`,
    action: "resolve",
    patch: { note: parsed.resolution_note ?? null },
  });
  return { incident: next, call_session: closed };
};

// --- simulate ---

type TranscriptSnippetFields = {
  speaker: string;
  text: string;
  is_final: boolean;
  created_at: string;
};

const parseRecentTranscriptSnippet = (raw: Json): TranscriptSnippetFields | null => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.speaker !== "string" || typeof o.text !== "string") {
    return null;
  }
  const is_final = typeof o.is_final === "boolean" ? o.is_final : true;
  const created_at = typeof o.created_at === "string" ? o.created_at : isoNow();
  return { speaker: o.speaker, text: o.text, is_final, created_at };
};

/**
 * Mirrors `appendTranscriptSupabase`: inserts new `transcript_events` rows so the
 * dashboard `LiveTranscriptPanel` (anon `transcript_events` select) sees simulate seeds.
 */
const persistSimulateSeedTranscriptEvents = async (
  client: ReturnType<typeof getServiceRoleClient>,
  incidentId: string,
  callSessionId: string,
  priorRecentLen: number,
  mergedRecent: Json[],
): Promise<void> => {
  const newSnippets = mergedRecent.slice(priorRecentLen);
  if (newSnippets.length === 0) {
    return;
  }

  const events: TranscriptEvent[] = [];
  for (const raw of newSnippets) {
    const p = parseRecentTranscriptSnippet(raw);
    if (!p) {
      continue;
    }
    events.push({
      id: newId(),
      incident_id: incidentId,
      call_session_id: callSessionId,
      speaker: p.speaker,
      text: p.text,
      is_final: p.is_final,
      language: null,
      translated_text: null,
      created_at: p.created_at,
    });
  }
  if (events.length === 0) {
    return;
  }

  if (!client) {
    appendSeedTranscriptEvents(events);
    return;
  }

  const { error } = await client.from("transcript_events").insert(
    events.map((e) => ({
      id: e.id,
      incident_id: e.incident_id,
      call_session_id: e.call_session_id,
      speaker: e.speaker,
      text: e.text,
      is_final: e.is_final,
      language: e.language,
      translated_text: e.translated_text,
      created_at: e.created_at,
    })),
  );
  if (error) {
    throw new Error(error.message);
  }
};

const persistSimulatedSeedEnrichment = async (
  client: ReturnType<typeof getServiceRoleClient>,
  r: {
    incident_id: string;
    call_session_id: string;
    incident: Incident;
    call_session: CallSession;
  },
  mode: AppMode,
  seedIndex: number,
  disasterBatch?: { batchLocalIndex: number; batchSize: number }
): Promise<{ incident: Incident; call_session: CallSession }> => {
  const priorRecentLen = r.call_session.recent_transcript.length;
  const merged = mergeSimulatedSurgeRow(
    r.incident,
    r.call_session,
    mode,
    seedIndex,
    disasterBatch ? { disasterBatch } : undefined,
  );
  if (!client) {
    saveIncident(merged.incident);
    saveCallSession(merged.call_session);
    await persistSimulateSeedTranscriptEvents(
      client,
      r.incident_id,
      r.call_session_id,
      priorRecentLen,
      merged.call_session.recent_transcript,
    );
    return merged;
  }
  const { error: iu } = await client
    .from("incidents")
    .update(incidentToDb(merged.incident))
    .eq("id", merged.incident.id);
  if (iu) {
    throw new Error(iu.message);
  }
  const { error: su } = await client
    .from("call_sessions")
    .update(callSessionToDb(merged.call_session))
    .eq("id", merged.call_session.id);
  if (su) {
    throw new Error(su.message);
  }
  await persistSimulateSeedTranscriptEvents(
    client,
    r.incident_id,
    r.call_session_id,
    priorRecentLen,
    merged.call_session.recent_transcript,
  );
  return merged;
};

const repositorySimulateSeed = async (input: {
  mode: AppMode;
  batch_size?: number;
  offset?: number;
  maxCap: number;
  reset_existing?: boolean;
}): Promise<{ created_incidents: Incident[]; created_call_sessions: CallSession[] }> => {
  const client = getServiceRoleClient();

  if (input.reset_existing) {
    if (!client) {
      resetDemoStore();
    } else {
      const { error } = await client
        .from("incidents")
        .delete()
        .gte("created_at", "1970-01-01T00:00:00Z");
      if (error) {
        throw new Error(error.message);
      }
    }
  }

  const skip = input.offset ?? 0;
  const requested = input.batch_size ?? Math.min(5, input.maxCap);
  const count = Math.min(Math.max(0, requested), input.maxCap);
  const { mode } = input;
  const disasterBatchFor = (batchLocalIndex: number) =>
    mode === "disaster" ? { batchLocalIndex, batchSize: count } : undefined;

  for (let i = 0; i < skip; i++) {
    const r = await repositoryCallStart({ mode });
    await persistSimulatedSeedEnrichment(client, r, mode, i, disasterBatchFor(i));
  }

  const created_incidents: Incident[] = [];
  const created_call_sessions: CallSession[] = [];

  if (!client) {
    for (let i = 0; i < count; i++) {
      const r = await repositoryCallStart({ mode });
      const merged = await persistSimulatedSeedEnrichment(
        client,
        r,
        mode,
        skip + i,
        disasterBatchFor(i),
      );
      created_incidents.push(merged.incident);
      created_call_sessions.push(merged.call_session);
      newAuditLog({
        incident_id: r.incident_id,
        actor: "simulate",
        action: `simulated_${mode}_seed`,
        patch: { batch_index: i },
      });
    }
    return { created_incidents, created_call_sessions };
  }

  for (let i = 0; i < count; i++) {
    const r = await repositoryCallStart({ mode });
    const merged = await persistSimulatedSeedEnrichment(
      client,
      r,
      mode,
      skip + i,
      disasterBatchFor(i),
    );
    created_incidents.push(merged.incident);
    created_call_sessions.push(merged.call_session);
    await insertAudit(client, {
      incident_id: r.incident_id,
      actor: "simulate",
      action: `simulated_${mode}_seed`,
      patch: { batch_index: i },
    });
  }
  return { created_incidents, created_call_sessions };
};

export const repositorySimulateDisaster = async (input: {
  batch_size?: number;
  offset?: number;
  maxCap: number;
  reset_existing?: boolean;
}): Promise<SimulateDisasterResponse> => {
  const { created_incidents, created_call_sessions } = await repositorySimulateSeed({
    mode: "disaster",
    ...input,
  });
  return { created_incidents, created_call_sessions, mode: "disaster" };
};

export const repositorySimulateWorldCup = async (input: {
  batch_size?: number;
  offset?: number;
  maxCap: number;
  reset_existing?: boolean;
}): Promise<SimulateWorldCupResponse> => {
  const { created_incidents, created_call_sessions } = await repositorySimulateSeed({
    mode: "world_cup",
    ...input,
  });
  // Pull event_layers from Supabase when configured (seeded by
  // `20260509200000_seed_event_layers.sql`); fall back to [] for
  // in-memory dev / vitest runs that don't bind Supabase.
  const eventLayerRecords = await listEventLayerRecordsForMode("world_cup");
  const event_layers = eventLayerRecords.map(mapEventLayerRow);
  return {
    created_incidents,
    created_call_sessions,
    event_layers,
    mode: "world_cup",
  };
};

/** Latest `caller_phone` for operator SMS when request omits `to`. */
export const repositoryLatestCallerPhoneForIncident = async (
  incident_id: string
): Promise<string | null> => {
  const client = getServiceRoleClient();
  if (!client) {
    const sessions = listCallSessionsForIncidentByCreatedDesc(incident_id);
    const raw = sessions[0]?.caller_phone?.trim();
    return raw && raw.length > 0 ? raw : null;
  }

  const { data, error } = await client
    .from("call_sessions")
    .select("caller_phone")
    .eq("incident_id", incident_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const raw =
    data?.caller_phone === null || data?.caller_phone === undefined
      ? null
      : String(data.caller_phone).trim();
  return raw && raw.length > 0 ? raw : null;
};

// --- operator send SMS (stub provider) ---

export const repositoryOperatorSendSms = async (
  parsed: OperatorSendSmsRequest
): Promise<OperatorSendSmsResponse> => {
  const client = getServiceRoleClient();
  if (!client) {
    const incident = getIncident(parsed.incident_id);
    if (!incident) throw new Error("NOT_FOUND");
    newAuditLog({
      incident_id: parsed.incident_id,
      actor: `operator:${parsed.operator_id}`,
      action: "send_sms",
      patch: { message: parsed.message },
    });
    return { incident_id: parsed.incident_id, sent: false };
  }

  const { data: row, error } = await client
    .from("incidents")
    .select("id")
    .eq("id", parsed.incident_id)
    .single();
  if (error || !row) throw new Error("NOT_FOUND");

  await insertAudit(client, {
    incident_id: parsed.incident_id,
    actor: `operator:${parsed.operator_id}`,
    action: "send_sms",
    patch: { message: parsed.message },
  });
  return { incident_id: parsed.incident_id, sent: false };
};

const mapGeoOpsClustersToDomain = (
  clusters: readonly GeoOpsSurgeCluster[]
): SurgeCluster[] =>
  clusters.map((c) => ({
    cluster_id: c.id,
    title: c.title,
    incident_count: c.incident_count,
    urgency_breakdown: { ...c.urgency_breakdown },
    summary: c.summary,
    top_recommended_action: c.top_recommended_action,
    incident_ids: [...c.incident_ids],
    center: { ...c.center },
  }));

const listEventLayerRecordsForMode = async (
  mode: "disaster" | "world_cup"
): Promise<Array<Record<string, unknown>>> => {
  const client = getServiceRoleClient();
  if (!client) return [];
  const { data, error } = await client
    .from("event_layers")
    .select("*")
    .eq("mode", mode)
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<Record<string, unknown>>;
};

/**
 * Runs deterministic Surge / GeoOps clustering over active incidents for the
 * requested mode, persists `cluster_id` on matching rows, and returns API-shaped
 * clusters plus updated incidents (`docs/api_contracts.md` §4.11).
 */
export const repositorySurgeAnalyze = async (
  parsed: SurgeAnalyzeRequest
): Promise<SurgeAnalyzeResponse> => {
  const client = getServiceRoleClient();
  const all = await repositoryListIncidentsForDev(200);
  const cohort = all.filter(
    (i) =>
      i.mode === parsed.mode &&
      i.status !== "resolved" &&
      i.status !== "abandoned"
  );

  const respondersRecords =
    parsed.include_responders === true
      ? getMockResponders().map((r) => ({ ...r }) as Record<string, unknown>)
      : undefined;
  const eventLayerRecords =
    parsed.include_event_layers === true
      ? await listEventLayerRecordsForMode(parsed.mode)
      : undefined;

  const geoInput = buildSurgeGeoOpsAgentInput({
    parsed,
    cohort,
    respondersRecords,
    eventLayerRecords,
  });

  const geoOut = await runSurgeGeoOpsAgent(geoInput);

  const clusters = mapGeoOpsClustersToDomain(geoOut.clusters);
  const incidentToCluster = new Map<string, string>();
  for (const c of geoOut.clusters) {
    for (const id of c.incident_ids) {
      incidentToCluster.set(id, c.id);
    }
  }

  const t = isoNow();
  const updated_incidents: Incident[] = [];

  for (const incident of cohort) {
    const cluster_id = incidentToCluster.get(incident.id) ?? null;
    const ranked = priorityScoreFromSurgeRank(
      incident.id,
      geoOut.top_priority_incident_ids
    );
    const next: Incident = {
      ...incident,
      cluster_id,
      priority_score: ranked ?? incident.priority_score,
      updated_at: t,
      last_updated_by: "system:surge_analyze",
    };

    if (!client) {
      saveIncident(next);
    } else {
      const { error } = await client
        .from("incidents")
        .update(incidentToDb(next))
        .eq("id", incident.id);
      if (error) throw new Error(error.message);
    }
    updated_incidents.push(next);
  }

  if (!client) {
    newAuditLog({
      incident_id: null,
      actor: "api",
      action: "surge_analyze",
      patch: {
        mode: parsed.mode,
        cluster_count: clusters.length,
        cohort_size: cohort.length,
      } as Json,
    });
  } else {
    await insertAudit(client, {
      incident_id: null,
      actor: "api",
      action: "surge_analyze",
      patch: {
        mode: parsed.mode,
        cluster_count: clusters.length,
        cohort_size: cohort.length,
      } as Json,
    });
  }

  return {
    clusters,
    updated_incidents,
    top_priority_incident_ids: geoOut.top_priority_incident_ids,
  };
};
