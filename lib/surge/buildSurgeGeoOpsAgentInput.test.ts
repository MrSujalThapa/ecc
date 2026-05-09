import { describe, expect, it } from "vitest";
import type { Incident } from "@/lib/types/domain";
import {
  buildSurgeGeoOpsAgentInput,
  priorityScoreFromSurgeRank,
} from "./buildSurgeGeoOpsAgentInput";

describe("priorityScoreFromSurgeRank", () => {
  it("scores highest rank at 1 and decreases", () => {
    const ids = ["a", "b", "c"];
    expect(priorityScoreFromSurgeRank("a", ids)).toBe(1);
    expect(priorityScoreFromSurgeRank("b", ids)).toBeLessThan(1);
    expect(priorityScoreFromSurgeRank("c", ids)).toBeLessThan(
      priorityScoreFromSurgeRank("b", ids)!
    );
  });

  it("returns null when id not in list", () => {
    expect(priorityScoreFromSurgeRank("x", ["a", "b"])).toBeNull();
  });

  it("returns 1 for single-id list", () => {
    expect(priorityScoreFromSurgeRank("only", ["only"])).toBe(1);
  });
});

describe("buildSurgeGeoOpsAgentInput", () => {
  it("maps cohort to activeIncidents and passes mode", () => {
    const cohort = [{ id: "i1", mode: "disaster" }] as Incident[];

    const input = buildSurgeGeoOpsAgentInput({
      parsed: { mode: "disaster" },
      cohort,
    });

    expect(input.mode).toBe("disaster");
    expect(input.activeIncidents).toHaveLength(1);
    expect((input.activeIncidents[0] as { id: string }).id).toBe("i1");
  });
});
