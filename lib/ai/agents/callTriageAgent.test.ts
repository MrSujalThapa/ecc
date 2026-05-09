import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runCallTriageAgent,
  runCallTriageAgentWithProvenance,
} from "./callTriageAgent";

const minimalValidJson = {
  tool_requests: [],
  incident_patch: { urgency: "non_emergency", incident_type: "test_case" },
  call_session_patch: { next_question: "What happened?" },
  system_actions: [],
  say_to_caller: "What happened?",
};

describe("runCallTriageAgent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses mock when provider is mock", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    const out = await runCallTriageAgent({
      latestTranscript: "Someone stole my bike.",
      mode: "normal",
    });
    expect(out.say_to_caller).toBeTruthy();
    expect(out.incident_patch.incident_type).toBe("bike_theft");
  });

  it("featherless without API key falls back to mock", async () => {
    vi.stubEnv("AI_PROVIDER", "featherless");
    vi.stubEnv("FEATHERLESS_API_KEY", "");
    const out = await runCallTriageAgent({
      latestTranscript: "Someone stole my bike.",
      mode: "normal",
    });
    expect(out.incident_patch.incident_type).toBe("bike_theft");
  });

  it("featherless uses API when key, model set and response validates", async () => {
    vi.stubEnv("AI_PROVIDER", "featherless");
    vi.stubEnv("FEATHERLESS_API_KEY", "test-key");
    vi.stubEnv("FEATHERLESS_MODEL", "test-model");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: JSON.stringify(minimalValidJson) },
            },
          ],
        }),
      })
    );

    const out = await runCallTriageAgent({
      latestTranscript: "anything",
      mode: "normal",
    });

    expect(out.incident_patch.incident_type).toBe("test_case");
    expect(out.say_to_caller).toBe("What happened?");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gemma without API key falls back to mock", async () => {
    vi.stubEnv("AI_PROVIDER", "gemma");
    vi.stubEnv("GEMMA_API_KEY", "");
    const out = await runCallTriageAgent({
      latestTranscript: "Someone stole my bike.",
      mode: "normal",
    });
    expect(out.incident_patch.incident_type).toBe("bike_theft");
  });

  it("gemma uses API when key set and response validates", async () => {
    vi.stubEnv("AI_PROVIDER", "gemma");
    vi.stubEnv("GEMMA_API_KEY", "test-key");
    vi.stubEnv("GEMMA_MODEL", "fake-model");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(minimalValidJson) }],
              },
            },
          ],
        }),
      })
    );

    const out = await runCallTriageAgent({
      latestTranscript: "anything",
      mode: "normal",
    });

    expect(out.incident_patch.incident_type).toBe("test_case");
    expect(out.say_to_caller).toBe("What happened?");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gemma falls back to mock when fetch fails", async () => {
    vi.stubEnv("AI_PROVIDER", "gemma");
    vi.stubEnv("GEMMA_API_KEY", "test-key");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network"))
    );

    const out = await runCallTriageAgent({
      latestTranscript: "Someone stole my bike.",
      mode: "normal",
    });

    expect(out.incident_patch.incident_type).toBe("bike_theft");
  });

  it("explicit provider arg overrides AI_PROVIDER", async () => {
    vi.stubEnv("AI_PROVIDER", "gemma");
    vi.stubEnv("GEMMA_API_KEY", "");
    const out = await runCallTriageAgent({
      provider: "mock",
      latestTranscript: "Someone stole my bike.",
      mode: "normal",
    });
    expect(out.incident_patch.incident_type).toBe("bike_theft");
  });
});

describe("runCallTriageAgentWithProvenance", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("falls back to mock with provider_error when featherless key missing", async () => {
    vi.stubEnv("AI_PROVIDER", "featherless");
    vi.stubEnv("FEATHERLESS_API_KEY", "");
    const result = await runCallTriageAgentWithProvenance({
      latestTranscript: "Someone stole my bike.",
      mode: "normal",
    });
    expect(result.requested_provider).toBe("featherless");
    expect(result.used_provider).toBe("mock");
    expect(result.provider_error).toMatch(/FEATHERLESS_API_KEY/);
  });

  it("falls back to mock with provider_error when featherless model missing", async () => {
    vi.stubEnv("AI_PROVIDER", "featherless");
    vi.stubEnv("FEATHERLESS_API_KEY", "k");
    vi.stubEnv("FEATHERLESS_MODEL", "");
    const result = await runCallTriageAgentWithProvenance({
      latestTranscript: "Someone stole my bike.",
      mode: "normal",
    });
    expect(result.requested_provider).toBe("featherless");
    expect(result.used_provider).toBe("mock");
    expect(result.provider_error).toMatch(/FEATHERLESS_MODEL/);
  });

  it("reports used_provider=featherless when fetch succeeds with valid JSON", async () => {
    vi.stubEnv("AI_PROVIDER", "featherless");
    vi.stubEnv("FEATHERLESS_API_KEY", "test-key");
    vi.stubEnv("FEATHERLESS_MODEL", "m");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  tool_requests: [],
                  incident_patch: {
                    urgency: "non_emergency",
                    incident_type: "test",
                  },
                  call_session_patch: { next_question: "?" },
                  system_actions: [],
                  say_to_caller: "?",
                }),
              },
            },
          ],
        }),
      })
    );
    const result = await runCallTriageAgentWithProvenance({
      latestTranscript: "anything",
      mode: "normal",
    });
    expect(result.used_provider).toBe("featherless");
    expect(result.provider_error).toBeNull();
  });

  it("reports used_provider=mock without provider_error when provider=mock", async () => {
    const result = await runCallTriageAgentWithProvenance({
      provider: "mock",
      latestTranscript: "Someone stole my bike.",
      mode: "normal",
    });
    expect(result.requested_provider).toBe("mock");
    expect(result.used_provider).toBe("mock");
    expect(result.provider_error).toBeNull();
  });

  it("falls back to mock with provider_error when gemma key missing", async () => {
    vi.stubEnv("AI_PROVIDER", "gemma");
    vi.stubEnv("GEMMA_API_KEY", "");
    const result = await runCallTriageAgentWithProvenance({
      latestTranscript: "Someone stole my bike.",
      mode: "normal",
    });
    expect(result.requested_provider).toBe("gemma");
    expect(result.used_provider).toBe("mock");
    expect(result.provider_error).toMatch(/GEMMA_API_KEY/);
  });

  it("falls back to mock with provider_error when gemma fetch fails", async () => {
    vi.stubEnv("AI_PROVIDER", "gemma");
    vi.stubEnv("GEMMA_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const result = await runCallTriageAgentWithProvenance({
      latestTranscript: "Someone stole my bike.",
      mode: "normal",
    });
    expect(result.requested_provider).toBe("gemma");
    expect(result.used_provider).toBe("mock");
    expect(result.provider_error).toMatch(/boom/);
  });

  it("reports used_provider=gemma when fetch succeeds with valid JSON", async () => {
    vi.stubEnv("AI_PROVIDER", "gemma");
    vi.stubEnv("GEMMA_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      tool_requests: [],
                      incident_patch: {
                        urgency: "non_emergency",
                        incident_type: "test",
                      },
                      call_session_patch: { next_question: "?" },
                      system_actions: [],
                      say_to_caller: "?",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })
    );
    const result = await runCallTriageAgentWithProvenance({
      latestTranscript: "anything",
      mode: "normal",
    });
    expect(result.used_provider).toBe("gemma");
    expect(result.provider_error).toBeNull();
  });
});
