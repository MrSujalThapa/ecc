import { describe, expect, it } from "vitest";
import {
  callEndRequestSchema,
  callStartRequestSchema,
  callTurnRequestSchema,
  operatorResolveRequestSchema,
  operatorSendSmsRequestSchema,
  operatorTakeoverRequestSchema,
  operatorUpdateIncidentRequestSchema,
  simulateBatchRequestSchema,
  triagePreviewRequestSchema,
} from "./api-requests";

describe("callStartRequestSchema", () => {
  it("accepts empty body (optional fields)", () => {
    const r = callStartRequestSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("accepts explicit mode", () => {
    const r = callStartRequestSchema.safeParse({ mode: "disaster" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mode).toBe("disaster");
  });
});

describe("callTurnRequestSchema", () => {
  it("rejects empty text when is_final false", () => {
    const r = callTurnRequestSchema.safeParse({
      incident_id: "a",
      call_session_id: "b",
      speaker: "caller",
      is_final: false,
    });
    expect(r.success).toBe(false);
  });

  it("accepts text with content", () => {
    const r = callTurnRequestSchema.safeParse({
      incident_id: "a",
      call_session_id: "b",
      speaker: "caller",
      text: "hello",
      is_final: false,
    });
    expect(r.success).toBe(true);
  });

  it("accepts final_transcript instead of text", () => {
    const r = callTurnRequestSchema.safeParse({
      incident_id: "a",
      call_session_id: "b",
      speaker: "caller",
      final_transcript: "help",
      is_final: true,
    });
    expect(r.success).toBe(true);
  });
});

describe("callEndRequestSchema", () => {
  it("requires reason or outcome", () => {
    const r = callEndRequestSchema.safeParse({
      incident_id: "i1",
      call_session_id: "s1",
    });
    expect(r.success).toBe(false);
  });

  it("accepts reason only", () => {
    const r = callEndRequestSchema.safeParse({
      incident_id: "i1",
      call_session_id: "s1",
      reason: "completed",
    });
    expect(r.success).toBe(true);
  });

  it("accepts legacy outcome only", () => {
    const r = callEndRequestSchema.safeParse({
      incident_id: "i1",
      call_session_id: "s1",
      outcome: "abandoned",
    });
    expect(r.success).toBe(true);
  });
});

describe("operatorTakeoverRequestSchema", () => {
  it("requires ids", () => {
    expect(operatorTakeoverRequestSchema.safeParse({}).success).toBe(false);
    expect(
      operatorTakeoverRequestSchema.safeParse({
        incident_id: "i",
        operator_id: "op",
      }).success
    ).toBe(true);
  });
});

describe("operatorUpdateIncidentRequestSchema", () => {
  it("accepts minimal patch", () => {
    const r = operatorUpdateIncidentRequestSchema.safeParse({
      incident_id: "i1",
      operator_id: "op1",
      patch: { urgency: "urgent" },
    });
    expect(r.success).toBe(true);
  });
});

describe("operatorResolveRequestSchema", () => {
  it("accepts optional resolution_note", () => {
    const r = operatorResolveRequestSchema.safeParse({
      incident_id: "i1",
      operator_id: "op1",
      resolution_note: "done",
    });
    expect(r.success).toBe(true);
  });
});

describe("operatorSendSmsRequestSchema", () => {
  it("requires non-empty message", () => {
    expect(
      operatorSendSmsRequestSchema.safeParse({
        incident_id: "i1",
        operator_id: "op1",
        message: "",
      }).success
    ).toBe(false);
    expect(
      operatorSendSmsRequestSchema.safeParse({
        incident_id: "i1",
        operator_id: "op1",
        message: "hi",
      }).success
    ).toBe(true);
  });
});

describe("simulateBatchRequestSchema", () => {
  it("accepts empty object", () => {
    expect(simulateBatchRequestSchema.safeParse({}).success).toBe(true);
  });

  it("accepts batch_size and offset", () => {
    const r = simulateBatchRequestSchema.safeParse({
      batch_size: 3,
      offset: 1,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.batch_size).toBe(3);
      expect(r.data.offset).toBe(1);
    }
  });

  it("accepts batch_size 0 and reset_existing", () => {
    const r = simulateBatchRequestSchema.safeParse({
      batch_size: 0,
      reset_existing: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.batch_size).toBe(0);
      expect(r.data.reset_existing).toBe(true);
    }
  });
});

describe("triagePreviewRequestSchema", () => {
  it("requires ids and transcript", () => {
    expect(
      triagePreviewRequestSchema.safeParse({
        incident: { id: "i1", mode: "normal" },
        call_session: { id: "s1", incident_id: "i1" },
        latest_transcript: "hello",
      }).success
    ).toBe(true);
    expect(
      triagePreviewRequestSchema.safeParse({
        incident: {},
        call_session: { id: "s1" },
        latest_transcript: "",
      }).success
    ).toBe(false);
  });
});
