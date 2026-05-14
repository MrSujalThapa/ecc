import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractCallerPhoneFromJsonPayload,
  resolveCallerPhoneJsonOrTwilio,
} from "./callerPhoneResolution";

const { fetchTwilioCallCallerFrom } = vi.hoisted(() => ({
  fetchTwilioCallCallerFrom: vi.fn(),
}));

vi.mock("./twilioClient", () => ({
  fetchTwilioCallCallerFrom,
}));

describe("callerPhoneResolution", () => {
  beforeEach(() => {
    fetchTwilioCallCallerFrom.mockReset();
  });

  it("extracts caller_phone from nested JSON payloads", () => {
    expect(
      extractCallerPhoneFromJsonPayload({
        custom_llm_extra_body: {
          dynamic_variables: {
            caller_phone: "+14155550123",
          },
        },
      })
    ).toBe("+14155550123");
  });

  it("prefers JSON-derived caller phone over Twilio lookup", async () => {
    fetchTwilioCallCallerFrom.mockResolvedValue("+14155559999");

    await expect(
      resolveCallerPhoneJsonOrTwilio({
        rawJson: {
          callerPhone: "+14155550123",
        },
        twilioCallSid: "CA123",
      })
    ).resolves.toBe("+14155550123");

    expect(fetchTwilioCallCallerFrom).not.toHaveBeenCalled();
  });

  it("falls back to Twilio lookup when JSON has no caller phone", async () => {
    fetchTwilioCallCallerFrom.mockResolvedValue("+14155550456");

    await expect(
      resolveCallerPhoneJsonOrTwilio({
        rawJson: { metadata: { other: "value" } },
        twilioCallSid: "CA456",
      })
    ).resolves.toBe("+14155550456");

    expect(fetchTwilioCallCallerFrom).toHaveBeenCalledWith("CA456");
  });
});
