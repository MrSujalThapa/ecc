import { describe, expect, it } from "vitest";
import { jsonError, repositoryErrorResponse } from "./api-route-helpers";

describe("repositoryErrorResponse", () => {
  it("maps NOT_FOUND to 404", () => {
    const res = repositoryErrorResponse(new Error("NOT_FOUND"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(404);
  });

  it("maps SESSION_MISMATCH to 400", () => {
    const res = repositoryErrorResponse(new Error("SESSION_MISMATCH"));
    expect(res!.status).toBe(400);
  });

  it("maps SESSION_INACTIVE to 409", () => {
    const res = repositoryErrorResponse(new Error("SESSION_INACTIVE"));
    expect(res!.status).toBe(409);
  });

  it("returns null for unknown errors", () => {
    expect(repositoryErrorResponse(new Error("random"))).toBeNull();
    expect(repositoryErrorResponse("string")).toBeNull();
  });
});

describe("jsonError", () => {
  it("returns JSON body with error message", async () => {
    const res = jsonError("bad", 400);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("bad");
  });
});
