import { beforeEach, describe, expect, it } from "vitest";
import {
  repositoryCallEnd,
  repositoryCallStart,
  repositoryCallTurn,
  repositoryListCallSessionsForDev,
  repositoryListIncidentsForDev,
  repositoryOperatorResolve,
  repositoryOperatorSendSms,
  repositoryOperatorTakeover,
  repositoryOperatorUpdateIncident,
  repositorySimulateDisaster,
  repositorySimulateWorldCup,
  repositorySurgeAnalyze,
} from "./call-repository";
import {
  getDemoStoreSizes,
  getIncident,
  getTranscriptHistoryForSession,
  listAuditLogsForIncident,
  resetDemoStore,
} from "@/lib/server/demo-store";

describe("call-repository (in-memory / no Supabase)", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  describe("repositoryCallStart", () => {
    it("returns linked incident and active call_session", async () => {
      const r = await repositoryCallStart({ mode: "normal" });
      expect(r.incident_id).toBe(r.incident.id);
      expect(r.call_session_id).toBe(r.call_session.id);
      expect(r.call_session.incident_id).toBe(r.incident.id);
      expect(r.call_session.status).toBe("active");
      expect(getIncident(r.incident_id)).toBeDefined();
    });
  });

  describe("repositoryCallTurn", () => {
    it("throws NOT_FOUND for unknown ids", async () => {
      await expect(
        repositoryCallTurn({
          incident_id: "missing-inc",
          call_session_id: "missing-ses",
          speaker: "caller",
          text: "hello",
          is_final: false,
        })
      ).rejects.toThrow("NOT_FOUND");
    });

    it("throws SESSION_MISMATCH when session belongs to another incident", async () => {
      const a = await repositoryCallStart({ mode: "normal" });
      const b = await repositoryCallStart({ mode: "normal" });
      await expect(
        repositoryCallTurn({
          incident_id: a.incident_id,
          call_session_id: b.call_session_id,
          speaker: "caller",
          text: "hello",
          is_final: false,
        })
      ).rejects.toThrow("SESSION_MISMATCH");
    });

    it("throws SESSION_INACTIVE when session is closed", async () => {
      const { incident_id, call_session_id } = await repositoryCallStart({
        mode: "normal",
      });
      await repositoryCallEnd({
        incident_id,
        call_session_id,
        reason: "completed",
      });
      await expect(
        repositoryCallTurn({
          incident_id,
          call_session_id,
          speaker: "caller",
          text: "hello",
          is_final: false,
        })
      ).rejects.toThrow("SESSION_INACTIVE");
    });

    it("returns transcript_event and empty actions when not final", async () => {
      const { incident_id, call_session_id } = await repositoryCallStart({
        mode: "normal",
      });
      const out = await repositoryCallTurn({
        incident_id,
        call_session_id,
        speaker: "caller",
        text: "hello there",
        is_final: false,
      });
      expect(out.transcript_event.text).toBe("hello there");
      expect(out.actions).toEqual([]);
      expect(out.call_session.recent_transcript.length).toBeGreaterThan(0);
    });

    it("runs triage on final turn and returns system_actions array", async () => {
      const { incident_id, call_session_id } = await repositoryCallStart({
        mode: "normal",
      });
      const out = await repositoryCallTurn({
        incident_id,
        call_session_id,
        speaker: "caller",
        text: "there is a fire in my kitchen",
        is_final: true,
      });
      expect(out.transcript_event.is_final).toBe(true);
      expect(Array.isArray(out.actions)).toBe(true);
      expect(out.incident.id).toBe(incident_id);
      const events = getTranscriptHistoryForSession(call_session_id);
      expect(events.map((e) => e.speaker)).toEqual(["caller", "ai"]);
      expect(events[1]?.text).toBe(out.say_to_caller);
    });

    it("two-pass tool loop: demo trigger geocodes location and writes coordinates", async () => {
      const { incident_id, call_session_id } = await repositoryCallStart({
        mode: "normal",
      });
      const out = await repositoryCallTurn({
        incident_id,
        call_session_id,
        speaker: "caller",
        text: "demo geocode at BMO Field",
        is_final: true,
      });

      expect(out.incident.coordinates).toEqual({
        lat: 43.6328,
        lng: -79.4187,
      });
      expect(out.incident.location).toBe(
        "BMO Field, Exhibition Place, Toronto"
      );
      expect(out.incident.location_status).toBe("approximate_by_ai");
      expect(out.say_to_caller).toMatch(/BMO Field/);

      expect(out.triage_trace).not.toBeNull();
      const trace = out.triage_trace!;
      expect(trace.passes).toBe(2);
      expect(trace.first_pass_tool_requests).toHaveLength(1);
      expect(trace.normalized_tool_requests).toHaveLength(1);
      expect(trace.tool_results).toHaveLength(1);
      expect(trace.tool_results.every((r) => r.ok === true)).toBe(true);
      const toolNames = trace.tool_results.map((r) => r.tool).sort();
      expect(toolNames).toEqual(["geocode_location"]);
      expect(trace.second_pass_error).toBeNull();
      expect(trace.requested_provider).toBe("mock");
      expect(trace.pass1_provider).toBe("mock");
      expect(trace.pass2_provider).toBe("mock");
      expect(trace.pass1_provider_error).toBeNull();
      expect(trace.pass2_provider_error).toBeNull();

      const audits = listAuditLogsForIncident(incident_id, "call_turn_final");
      expect(audits).toHaveLength(1);
      const patch = audits[0]!.patch as { passes: number };
      expect(patch.passes).toBe(2);
    });

    it("two-pass loop is a no-op for non-demo transcripts (passes=1)", async () => {
      const { incident_id, call_session_id } = await repositoryCallStart({
        mode: "normal",
      });
      const out = await repositoryCallTurn({
        incident_id,
        call_session_id,
        speaker: "caller",
        text: "someone stole my bike",
        is_final: true,
      });
      expect(out.triage_trace).not.toBeNull();
      expect(out.triage_trace!.passes).toBe(1);
      expect(out.triage_trace!.tool_results).toEqual([]);
      const audits = listAuditLogsForIncident(incident_id, "call_turn_final");
      expect(audits).toHaveLength(1);
      const patch = audits[0]!.patch as { passes: number };
      expect(patch.passes).toBe(1);
    });

    it("partial turn returns triage_trace = null (no triage runs)", async () => {
      const { incident_id, call_session_id } = await repositoryCallStart({
        mode: "normal",
      });
      const out = await repositoryCallTurn({
        incident_id,
        call_session_id,
        speaker: "caller",
        text: "hello",
        is_final: false,
      });
      expect(out.triage_trace).toBeNull();
    });
  });

  describe("repositoryCallEnd", () => {
    it("closes session and maps completed reason to resolved", async () => {
      const { incident_id, call_session_id } = await repositoryCallStart({
        mode: "normal",
      });
      const out = await repositoryCallEnd({
        incident_id,
        call_session_id,
        reason: "completed",
      });
      expect(out.call_session.status).toBe("closed");
      expect(out.incident.status).toBe("resolved");
    });

    it("accepts legacy outcome field", async () => {
      const { incident_id, call_session_id } = await repositoryCallStart({
        mode: "normal",
      });
      const out = await repositoryCallEnd({
        incident_id,
        call_session_id,
        outcome: "abandoned",
      });
      expect(out.incident.status).toBe("abandoned");
    });
  });

  describe("repositoryOperatorTakeover", () => {
    it("sets human_active and closes active session", async () => {
      const { incident_id, call_session_id } = await repositoryCallStart({
        mode: "normal",
      });
      const out = await repositoryOperatorTakeover({
        incident_id,
        operator_id: "op-1",
      });
      expect(out.incident.status).toBe("human_active");
      expect(out.incident.assigned_operator).toBe("op-1");
      expect(out.call_session).not.toBeNull();
      expect(out.call_session!.id).toBe(call_session_id);
      expect(out.call_session!.status).toBe("closed");
    });
  });

  describe("repositoryOperatorUpdateIncident", () => {
    it("merges patch in memory", async () => {
      const { incident_id } = await repositoryCallStart({ mode: "normal" });
      const out = await repositoryOperatorUpdateIncident({
        incident_id,
        operator_id: "op-1",
        patch: { urgency: "urgent", summary: "Updated summary" },
      });
      expect(out.incident.urgency).toBe("urgent");
      expect(out.incident.summary).toBe("Updated summary");
      expect(out.incident.last_updated_by).toBe("operator:op-1");
    });
  });

  describe("repositoryOperatorResolve", () => {
    it("marks incident resolved and closes active session", async () => {
      const { incident_id, call_session_id: activeSessionId } =
        await repositoryCallStart({
        mode: "normal",
      });
      const out = await repositoryOperatorResolve({
        incident_id,
        operator_id: "op-1",
        resolution_note: "cleared",
      });
      expect(out.incident.status).toBe("resolved");
      expect(out.call_session).not.toBeNull();
      expect(out.call_session!.id).toBe(activeSessionId);
      expect(out.call_session!.status).toBe("closed");
      expect(out.incident.recommended_action).toBe("cleared");
    });
  });

  describe("repositoryOperatorSendSms", () => {
    it("throws NOT_FOUND for unknown incident", async () => {
      await expect(
        repositoryOperatorSendSms({
          incident_id: "no-such",
          operator_id: "op-1",
          message: "test",
        })
      ).rejects.toThrow("NOT_FOUND");
    });

    it("returns sent false for known incident", async () => {
      const { incident_id } = await repositoryCallStart({ mode: "normal" });
      const out = await repositoryOperatorSendSms({
        incident_id,
        operator_id: "op-1",
        message: "stay safe",
      });
      expect(out.sent).toBe(false);
      expect(out.incident_id).toBe(incident_id);
    });
  });

  describe("repositorySimulateDisaster", () => {
    it("creates batch_size incidents when offset is 0", async () => {
      const out = await repositorySimulateDisaster({
        offset: 0,
        batch_size: 2,
        maxCap: 10,
      });
      expect(out.created_incidents).toHaveLength(2);
      expect(out.created_call_sessions).toHaveLength(2);
      expect(out.mode).toBe("disaster");
      expect(out.created_incidents[0]?.assigned_operator).toBe("DIS-SIM-OP-01");
      expect(out.created_incidents[1]?.assigned_operator).toBe("DIS-SIM-OP-02");
      expect(out.created_incidents[0]?.status).toBe("human_active");
      expect(out.created_incidents[0]?.control_state).toBe("human_active");
      expect(out.created_incidents[0]?.ai_active).toBe(false);
      expect(out.created_incidents[1]?.status).toBe("human_active");
      expect(out.created_incidents[1]?.control_state).toBe("human_active");
      expect(out.created_incidents[0]?.incident_type).toBe("structure_fire");
      expect(out.created_incidents[0]?.coordinates).not.toBeNull();
      expect(out.created_incidents[0]?.summary).toContain("smoke");
      expect(out.created_call_sessions[0]?.next_question).toContain("floor");
      const rt = out.created_call_sessions[0]?.recent_transcript ?? [];
      expect(rt).toHaveLength(2);
      expect((rt[0] as { speaker?: string }).speaker).toBe("caller");
      expect((rt[1] as { speaker?: string }).speaker).toBe("ai");
      const sid = out.created_call_sessions[0]?.id;
      expect(sid).toBeTruthy();
      expect(getTranscriptHistoryForSession(sid!).map((e) => e.speaker)).toEqual([
        "caller",
        "ai",
      ]);
      const sizes = getDemoStoreSizes();
      expect(sizes.incidents).toBe(2);
      expect(sizes.callSessions).toBe(2);
    });

    it("burns offset seeds then returns batch_size new rows", async () => {
      const out = await repositorySimulateDisaster({
        offset: 2,
        batch_size: 2,
        maxCap: 10,
      });
      expect(out.created_incidents).toHaveLength(2);
      const sizes = getDemoStoreSizes();
      expect(sizes.incidents).toBe(4);
      expect(sizes.callSessions).toBe(4);
    });

    it("reset_existing clears the store then seeds the batch", async () => {
      await repositoryCallStart({ mode: "normal" });
      expect(getDemoStoreSizes().incidents).toBe(1);
      const out = await repositorySimulateDisaster({
        reset_existing: true,
        batch_size: 2,
        offset: 0,
        maxCap: 10,
      });
      expect(out.created_incidents).toHaveLength(2);
      expect(getDemoStoreSizes().incidents).toBe(2);
    });

    it("reset_existing with batch_size 0 leaves an empty store", async () => {
      await repositoryCallStart({ mode: "normal" });
      const out = await repositorySimulateDisaster({
        reset_existing: true,
        batch_size: 0,
        offset: 0,
        maxCap: 10,
      });
      expect(out.created_incidents).toHaveLength(0);
      expect(getDemoStoreSizes().incidents).toBe(0);
    });

    it("assigns at most one incident per DIS-SIM operator (10 of 50)", async () => {
      const out = await repositorySimulateDisaster({
        reset_existing: true,
        offset: 0,
        batch_size: 50,
        maxCap: 100,
      });
      expect(out.created_incidents).toHaveLength(50);
      const withOp = out.created_incidents.filter((i) => i.assigned_operator !== null);
      const withoutOp = out.created_incidents.filter((i) => i.assigned_operator === null);
      expect(withOp).toHaveLength(10);
      expect(withoutOp).toHaveLength(40);
      const distinct = new Set(
        out.created_incidents.map((i) => i.assigned_operator).filter(Boolean),
      );
      expect(distinct.size).toBe(10);
      expect(out.created_incidents[0]?.assigned_operator).toBe("DIS-SIM-OP-01");
      expect(out.created_incidents[9]?.assigned_operator).toBe("DIS-SIM-OP-10");
      expect(out.created_incidents[10]?.assigned_operator).toBeNull();
      expect(out.created_incidents[40]?.assigned_operator).toBeNull();
      expect(
        withOp.every(
          (i) =>
            i.status === "human_active" &&
            i.control_state === "human_active" &&
            i.ai_active === false,
        ),
      ).toBe(true);
      expect(withoutOp.every((i) => i.status !== "human_active")).toBe(true);
    });
  });

  describe("repositorySimulateWorldCup", () => {
    it("seeds world_cup incidents and returns empty event_layers", async () => {
      const out = await repositorySimulateWorldCup({
        offset: 0,
        batch_size: 1,
        maxCap: 5,
      });
      expect(out.mode).toBe("world_cup");
      expect(out.event_layers).toEqual([]);
      expect(out.created_incidents[0]?.mode).toBe("world_cup");
      expect(out.created_incidents[0]?.incident_type).toBe("crowd_safety");
      expect(out.created_incidents[0]?.coordinates).not.toBeNull();
      expect(out.created_call_sessions[0]?.next_question).toContain("gate");
      expect(out.created_call_sessions[0]?.recent_transcript).toHaveLength(2);
    });
  });

  describe("repositorySurgeAnalyze", () => {
    it("clusters disaster cohort and persists cluster_id", async () => {
      await repositorySimulateDisaster({
        batch_size: 2,
        maxCap: 29,
        reset_existing: true,
      });
      const out = await repositorySurgeAnalyze({
        mode: "disaster",
        include_responders: true,
      });
      expect(out.top_priority_incident_ids.length).toBe(2);
      expect(out.updated_incidents.length).toBe(2);
      expect(out.clusters.length).toBeGreaterThanOrEqual(1);
      for (const inc of out.updated_incidents) {
        expect(inc.cluster_id).toBeTruthy();
        expect(
          out.clusters.some(
            (c) => c.cluster_id === inc.cluster_id && c.incident_ids.includes(inc.id)
          )
        ).toBe(true);
      }
      const [firstId, secondId] = out.top_priority_incident_ids;
      const first = out.updated_incidents.find((i) => i.id === firstId);
      const second = out.updated_incidents.find((i) => i.id === secondId);
      expect(first?.priority_score).toBeDefined();
      expect(second?.priority_score).toBeDefined();
      expect(first!.priority_score!).toBeGreaterThanOrEqual(second!.priority_score!);
    });
  });

  describe("repositoryListIncidentsForDev", () => {
    it("returns incidents from the in-memory store sorted by updated_at", async () => {
      const a = await repositoryCallStart({ mode: "normal" });
      const b = await repositoryCallStart({ mode: "disaster" });
      const rows = await repositoryListIncidentsForDev(10);
      expect(rows.length).toBe(2);
      expect(rows.map((r) => r.id).sort()).toEqual([a.incident_id, b.incident_id].sort());
    });
  });

  describe("repositoryListCallSessionsForDev", () => {
    it("returns sessions for one incident from the in-memory store", async () => {
      const { incident_id, call_session_id } = await repositoryCallStart({
        mode: "normal",
      });
      const rows = await repositoryListCallSessionsForDev(incident_id);
      expect(rows.length).toBe(1);
      expect(rows[0]?.id).toBe(call_session_id);
      expect(rows[0]?.incident_id).toBe(incident_id);
    });
  });
});
