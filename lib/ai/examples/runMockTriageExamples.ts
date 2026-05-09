/**
 * Lightweight runner for the mock Call Triage Agent examples.
 *
 * Backend / developer usage:
 *
 *   import { runMockTriageExamples } from "@/lib/ai/examples/runMockTriageExamples";
 *
 *   const results = await runMockTriageExamples();
 *   console.log(results);
 *
 * This is intentionally NOT a test framework. It is a plain async helper that
 * runs every fixture in `mockTriageExamples` through `mockCallTriageAgent`
 * and reports actual vs expected fields, plus a single pass/fail flag.
 *
 * `pass` is true only when ALL of these match expected:
 *   - urgency
 *   - incident_type
 *   - operator_required
 *   - should_escalate
 */

import { mockCallTriageAgent } from "@/lib/ai/agents/mockCallTriageAgent";
import {
  mockTriageExamples,
  type MockTriageExample,
  type MockTriageExpected,
} from "@/lib/ai/examples/mockTriageExamples";

export interface MockTriageActual {
  urgency?: string;
  incident_type?: string;
  operator_required?: boolean;
  should_escalate?: boolean;
}

export interface MockTriageRunResult {
  id: string;
  name: string;
  transcript: string;
  expected: MockTriageExpected;
  actual: MockTriageActual;
  pass: boolean;
  say_to_caller: string;
  error?: string;
}

async function runOne(
  example: MockTriageExample
): Promise<MockTriageRunResult> {
  try {
    const output = await mockCallTriageAgent({
      latestTranscript: example.latestTranscript,
      mode: example.mode,
    });

    const actual: MockTriageActual = {
      urgency: output.incident_patch?.urgency,
      incident_type: output.incident_patch?.incident_type,
      operator_required: output.incident_patch?.operator_required,
      should_escalate: output.call_session_patch?.should_escalate,
    };

    const pass =
      actual.urgency === example.expected.urgency &&
      actual.incident_type === example.expected.incident_type &&
      actual.operator_required === example.expected.operator_required &&
      actual.should_escalate === example.expected.should_escalate;

    return {
      id: example.id,
      name: example.name,
      transcript: example.latestTranscript,
      expected: example.expected,
      actual,
      pass,
      say_to_caller: output.say_to_caller,
    };
  } catch (err) {
    return {
      id: example.id,
      name: example.name,
      transcript: example.latestTranscript,
      expected: example.expected,
      actual: {},
      pass: false,
      say_to_caller: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runMockTriageExamples(): Promise<MockTriageRunResult[]> {
  const results: MockTriageRunResult[] = [];
  for (const example of mockTriageExamples) {
    results.push(await runOne(example));
  }
  return results;
}

export default runMockTriageExamples;
