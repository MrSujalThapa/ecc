import { describe, expect, it } from "vitest";
import { parseModelJsonText } from "./gemmaClient";

describe("parseModelJsonText", () => {
  it("parses plain JSON", () => {
    expect(parseModelJsonText('{"a":1,"b":"x"}')).toEqual({ a: 1, b: "x" });
  });

  it("strips ```json fences", () => {
    const text = "```json\n{\n  \"a\": 1\n}\n```";
    expect(parseModelJsonText(text)).toEqual({ a: 1 });
  });

  it("extracts the first balanced JSON object out of preamble prose (Gemma case)", () => {
    const text = "Sure, here is the JSON response:\n* Mode: normal\n{\n  \"say_to_caller\": \"Hi\",\n  \"incident_patch\": {\"urgency\": \"non_emergency\"}\n}\nLet me know if you want changes.";
    expect(parseModelJsonText(text)).toEqual({
      say_to_caller: "Hi",
      incident_patch: { urgency: "non_emergency" },
    });
  });

  it("handles braces nested inside JSON strings", () => {
    const text = 'noise {"label":"a {nested} value","ok":true} trailing';
    expect(parseModelJsonText(text)).toEqual({
      label: "a {nested} value",
      ok: true,
    });
  });

  it("throws a descriptive error when no JSON object is present", () => {
    expect(() => parseModelJsonText("* Mode: normal\n* Urgency: high")).toThrowError(
      /Model output did not contain valid JSON/
    );
  });
});
