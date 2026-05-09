# Backend Integration Handoff: Call Triage Agent

This document is for the backend teammate wiring transcript turns into the AI
pipeline. Production paths use **`runCallTriageAgent`** (`AI_PROVIDER=mock |
gemma | featherless`), which keeps the mock as a safe fallback when Gemma fails
or keys are missing. The agent code never writes to Supabase or calls Twilio,
ElevenLabs, or Mapbox directly.

The backend remains responsible for all persistence, validation boundaries,
audit logs, transfers, SMS, and any external actions.

## Exported entrypoint (preferred)

```ts
runCallTriageAgent({
  incident,
  callSession,
  latestTranscript,
  transcriptHistory,
  mode,
  provider: process.env.AI_PROVIDER,
})
```

Import:

```ts
import { runCallTriageAgent } from "@/lib/ai/agents/callTriageAgent";
```

For tests or deterministic-only runs you can still import **`mockCallTriageAgent`** directly from `@/lib/ai/agents/mockCallTriageAgent`.

## Input Shape

```ts
{
  incident,
  callSession,
  latestTranscript,
  transcriptHistory,
  mode
}
```

Notes:

- `incident`: current Incident-like object from backend state.
- `callSession`: current CallSession-like object from backend state.
- `latestTranscript`: latest final transcript turn; can be a string or an
  object with `text` / `final_transcript`.
- `transcriptHistory`: optional list of previous transcript turns.
- `mode`: `"normal" | "disaster" | "world_cup"`.

## Output Shape

```ts
{
  tool_requests,
  incident_patch,
  call_session_patch,
  system_actions,
  say_to_caller
}
```

Notes:

- `tool_requests`: proposed tool calls only. Backend decides whether to run
  them.
- `incident_patch`: partial Incident update candidate.
- `call_session_patch`: partial CallSession update candidate.
- `system_actions`: proposed system actions only. Backend decides whether to
  execute them.
- `say_to_caller`: short caller-facing phrase/question to return to the voice
  layer.

The mock agent validates its own output against the Zod schema before
returning. Backend can still reuse `validateTriageAgentOutput` as a boundary
check if it receives raw JSON from a future model provider.

## Provider-Aware Runner

The mock import above remains valid for deterministic testing. For backend
integration that can switch between mock, current Gemma testing/demo, and
future Featherless support, use:

```ts
import { runCallTriageAgent } from "@/lib/ai/agents/callTriageAgent";
```

Current provider options:

- `AI_PROVIDER=mock`: fallback/testing provider.
- `AI_PROVIDER=gemma`: current real AI testing/demo provider.
- `AI_PROVIDER=featherless`: reserved for later when subscription/API access
  is ready.

Backend can pass:

```ts
provider: process.env.AI_PROVIDER
```

If Gemma is selected but the key is missing, times out, fails, or returns
invalid JSON, `runCallTriageAgent` falls back to mock AI.

## Example `/api/call/turn` Usage

Do not copy this as a complete route. It is a wiring sketch showing where the
mock agent fits inside the backend-owned flow.

```ts
import { mockCallTriageAgent } from "@/lib/ai/agents/mockCallTriageAgent";
import { validateTriageAgentOutput } from "@/lib/ai/schemas/triageAgentOutputSchema";

export async function POST(request: Request) {
  const body = await request.json();

  // 1. Save the final transcript event first.
  const transcriptEvent = await saveTranscriptEvent({
    incidentId: body.incident_id,
    callSessionId: body.call_session_id,
    speaker: body.speaker,
    text: body.text,
    isFinal: body.is_final,
  });

  // 2. Load current backend state.
  const incident = await getIncident(body.incident_id);
  const callSession = await getCallSession(body.call_session_id);
  const transcriptHistory = await getTranscriptHistory(body.call_session_id);

  // 3. Call the mock AI agent.
  const aiOutput = await mockCallTriageAgent({
    incident,
    callSession,
    latestTranscript: transcriptEvent.text,
    transcriptHistory,
    mode: incident.mode ?? "normal",
  });

  // 4. Optional extra backend boundary validation.
  const validatedOutput = validateTriageAgentOutput(aiOutput);

  // 5. Merge patches safely through backend helpers.
  const updatedIncident = await updateIncidentSafely(
    incident.id,
    validatedOutput.incident_patch
  );
  const updatedCallSession = await updateCallSessionSafely(
    callSession.id,
    validatedOutput.call_session_patch
  );

  // 6. Write an audit log for traceability.
  await writeAuditLog({
    incidentId: incident.id,
    actor: "mock_call_triage_agent",
    action: "triage_turn_completed",
    patch: validatedOutput,
  });

  // 7. Return the caller-facing phrase to the voice layer.
  return Response.json({
    say_to_caller: validatedOutput.say_to_caller,
    incident: updatedIncident,
    call_session: updatedCallSession,
    actions: validatedOutput.system_actions,
  });
}
```

## Backend Responsibilities

For each final transcript turn, backend should:

- Save the transcript event first.
- Call `mockCallTriageAgent` for deterministic mock-only testing, or
  `runCallTriageAgent` for provider-aware mock/Gemma/future Featherless usage.
- Validate the output boundary.
- Update Incident using `incident_patch`.
- Update CallSession using `call_session_patch`.
- Write an AuditLog.
- Return `say_to_caller`.

The AI agent should not directly persist anything. It only returns validated
JSON decisions.

## Mock Testing Helper

Import the lightweight examples runner:

```ts
import { runMockTriageExamples } from "@/lib/ai/examples/runMockTriageExamples";
```

Usage:

```ts
const results = await runMockTriageExamples();
```

Each result includes the transcript, expected values, actual values, pass/fail,
and `say_to_caller`. This can be called manually from backend debug code or a
temporary local script. It is not a test framework.

## Current Provider Setup and Future Featherless Switch

This mock path is now wrapped by a provider-aware runner. Backend can call:

```ts
const result = await runCallTriageAgent({
  incident,
  callSession,
  latestTranscript,
  transcriptHistory,
  mode,
  provider: process.env.AI_PROVIDER,
});
```

Use these provider values:

```env
AI_PROVIDER=mock
```

```env
AI_PROVIDER=gemma
GEMMA_API_KEY=your_real_key_here
GEMMA_MODEL=gemma-4-26b-a4b-it
```

```env
AI_PROVIDER=featherless
FEATHERLESS_API_KEY=your_real_key_here
FEATHERLESS_MODEL=model_name_here
```

Gemma is the current real-AI testing/demo provider because Featherless
subscription/API access is not available yet. Featherless is not currently
required and should be added later. Keep `AI_PROVIDER=mock` available as a demo
fallback so the app can still run if model credentials or provider availability
fail during the hackathon demo.

## Backend Teammate Checklist

- Can import `mockCallTriageAgent`.
- Can call it inside `/api/call/turn`.
- Can import `runCallTriageAgent` for provider-aware mock/Gemma usage.
- Can pass `provider: process.env.AI_PROVIDER`.
- Can merge `incident_patch` safely.
- Can merge `call_session_patch` safely.
- Can display `say_to_caller` in response.
- Can keep `AI_PROVIDER=mock` for demo fallback.
