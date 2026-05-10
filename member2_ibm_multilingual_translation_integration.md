# Member 2 Addendum — IBM Multilingual Translation Integration

## Purpose

This file extends:

```text
docs/team/member2_voice_telephony_agentic_integration_plan.md
```

It explains how Member 2 should integrate **IBM Watson Language Translator** into the voice/telephony path without replacing ElevenLabs, Featherless/Gemma, Supabase, Twilio, or Mapbox.

The feature name for the demo is:

```text
IBM Multilingual Incident Layer
```

The goal is to make World Cup / event-surge calls useful for non-English callers:

```text
Caller speaks non-English
→ ElevenLabs captures final transcript
→ backend/voice layer enriches transcript with IBM translation
→ /api/call/turn receives original text + translated_text
→ Featherless/Gemma/mock triage uses translated English when available
→ Supabase stores original + translated transcript
→ dashboard shows caller language and IBM translation
→ optional SMS can later be sent in the caller language
```

This is not a fallback. It is a real product feature: operators can understand multilingual callers during event surges.

---

## Why IBM Fits Here

IBM Cloud's free tier lists **IBM Watson Language Translator** with **1,000,000 characters per month** and describes it as a service for translating text, documents, and websites from one language to another.

Source to verify during setup:

```text
https://www.ibm.com/products/cloud/free
```

This is useful for the hackathon because:

```text
- it has a clear free-tier path;
- it does not replace ElevenLabs voice;
- it does not replace Featherless/Gemma reasoning;
- it does not replace Supabase persistence;
- it fits the existing `language` and `translated_text` fields;
- it strengthens the World Cup/event-surge story.
```

---

## Member 2 Ownership Boundary

Member 2 owns the voice/telephony ingestion path.

Member 2 should own or coordinate these files:

```text
/lib/voice/ibmLanguageTranslator.ts
/lib/voice/transcriptTranslation.ts
/lib/voice/voiceConfig.ts
/app/api/elevenlabs/webhook/route.ts
/app/api/twilio/* only if the Twilio flow needs caller language metadata
/components/dev/ElevenLabsVoiceSimulator.tsx only if improving multilingual demo testing
/lib/simulate/* only if adding multilingual demo transcripts
```

Member 2 should not directly modify these unless explicitly assigned:

```text
/lib/ai/*
/lib/db/*
/lib/server/*
/lib/supabase/*
/lib/validation/*
/components/dashboard/*
/components/map/*
supabase/migrations/*
```

If a shared type or API contract needs to change, pause and coordinate with Member 1. Ideally, no contract change is needed because the active `/api/call/turn` contract already supports:

```ts
language?: string | null;
translated_text?: string | null;
```

---

## Environment Variables

Add these to `.env.example` and local `.env.local`.

```env
# IBM Watson Language Translator
IBM_TRANSLATION_ENABLED=false
IBM_LANGUAGE_TRANSLATOR_API_KEY=
IBM_LANGUAGE_TRANSLATOR_URL=
IBM_LANGUAGE_TRANSLATOR_VERSION=2018-05-01
IBM_TRANSLATION_TARGET_LANGUAGE=en
```

Recommended local defaults:

```env
IBM_TRANSLATION_ENABLED=false
AI_PROVIDER=mock
```

For the live demo, switch to:

```env
IBM_TRANSLATION_ENABLED=true
```

Do not expose IBM credentials to the frontend.

---

## Dependency

Use IBM's Node SDK if it is not already installed:

```bash
npm install ibm-watson
```

If the package version differs, verify the exact client import from IBM's current docs.

---

## Core Integration Rule

Only translate **final caller transcript turns**.

```text
Partial transcript = optional display/logging only
Final transcript = translate if needed, then send to /api/call/turn
```

Do not run IBM translation on every partial word or interim transcript. That wastes free-tier quota and increases latency.

---

## Target Flow

### Current Member 2 flow

```text
ElevenLabs transcript event
→ parse provider payload
→ determine incident_id + call_session_id
→ if transcript is final, call /api/call/turn
→ read say_to_caller from response
→ return/trigger next voice response
```

### New IBM-enriched flow

```text
ElevenLabs transcript event
→ parse provider payload
→ determine incident_id + call_session_id
→ if transcript is final, call enrichTranscriptWithIbmTranslation
→ send original text + language + translated_text to /api/call/turn
→ read say_to_caller from backend response
→ speak backend-approved response to caller
```

The voice layer still does not call Featherless directly and does not write to Supabase directly.

---

## Data Shape

Create a small voice-layer type:

```ts
export type TranslatedTranscript = {
  original_text: string;
  language: string | null;
  translated_text: string | null;
  translation_provider: "ibm_watson_language_translator" | "none" | "disabled" | "failed";
  translation_confidence?: number | null;
  error?: string | null;
};
```

When sending to `/api/call/turn`, map it to the active API contract:

```ts
const body = {
  incident_id,
  call_session_id,
  speaker: "caller",
  text: translated.original_text,
  is_final: true,
  language: translated.language,
  translated_text: translated.translated_text,
};
```

Important: preserve the caller's original words in `text`. Put the English translation in `translated_text`.

---

## Suggested File: `/lib/voice/ibmLanguageTranslator.ts`

```ts
import LanguageTranslatorV3 from "ibm-watson/language-translator/v3";
import { IamAuthenticator } from "ibm-watson/auth";

export type IbmTranslationResult = {
  sourceLanguage: string | null;
  translatedText: string | null;
  provider: "ibm_watson_language_translator";
};

function getTranslatorClient() {
  const apiKey = process.env.IBM_LANGUAGE_TRANSLATOR_API_KEY;
  const serviceUrl = process.env.IBM_LANGUAGE_TRANSLATOR_URL;
  const version = process.env.IBM_LANGUAGE_TRANSLATOR_VERSION ?? "2018-05-01";

  if (!apiKey || !serviceUrl) {
    return null;
  }

  const client = new LanguageTranslatorV3({
    version,
    authenticator: new IamAuthenticator({ apikey: apiKey }),
    serviceUrl,
  });

  return client;
}

export async function translateTextToEnglishWithIbm(text: string): Promise<IbmTranslationResult> {
  const client = getTranslatorClient();

  if (!client) {
    return {
      sourceLanguage: null,
      translatedText: null,
      provider: "ibm_watson_language_translator",
    };
  }

  const trimmed = text.trim();

  if (!trimmed) {
    return {
      sourceLanguage: null,
      translatedText: null,
      provider: "ibm_watson_language_translator",
    };
  }

  const identifyResponse = await client.identify({ text: trimmed });
  const languages = identifyResponse.result.languages ?? [];
  const sourceLanguage = languages[0]?.language ?? null;

  if (!sourceLanguage || sourceLanguage === "en") {
    return {
      sourceLanguage: sourceLanguage ?? "en",
      translatedText: null,
      provider: "ibm_watson_language_translator",
    };
  }

  const translateResponse = await client.translate({
    text: [trimmed],
    source: sourceLanguage,
    target: process.env.IBM_TRANSLATION_TARGET_LANGUAGE ?? "en",
  });

  const translatedText = translateResponse.result.translations?.[0]?.translation ?? null;

  return {
    sourceLanguage,
    translatedText,
    provider: "ibm_watson_language_translator",
  };
}
```

If the installed SDK requires `modelId` instead of `source` / `target`, use:

```ts
modelId: `${sourceLanguage}-en`
```

and verify the language pair in IBM's docs or console.

---

## Suggested File: `/lib/voice/transcriptTranslation.ts`

```ts
import { translateTextToEnglishWithIbm } from "./ibmLanguageTranslator";

export type TranslatedTranscript = {
  original_text: string;
  language: string | null;
  translated_text: string | null;
  translation_provider: "ibm_watson_language_translator" | "none" | "disabled" | "failed";
  error?: string | null;
};

export async function enrichTranscriptWithIbmTranslation(input: {
  text: string;
  providerLanguage?: string | null;
  isFinal: boolean;
}): Promise<TranslatedTranscript> {
  const originalText = input.text.trim();

  if (!input.isFinal) {
    return {
      original_text: originalText,
      language: input.providerLanguage ?? null,
      translated_text: null,
      translation_provider: "none",
    };
  }

  if (process.env.IBM_TRANSLATION_ENABLED !== "true") {
    return {
      original_text: originalText,
      language: input.providerLanguage ?? null,
      translated_text: null,
      translation_provider: "disabled",
    };
  }

  try {
    const result = await translateTextToEnglishWithIbm(originalText);

    return {
      original_text: originalText,
      language: result.sourceLanguage ?? input.providerLanguage ?? null,
      translated_text: result.translatedText,
      translation_provider: result.translatedText ? "ibm_watson_language_translator" : "none",
    };
  } catch (error) {
    return {
      original_text: originalText,
      language: input.providerLanguage ?? null,
      translated_text: null,
      translation_provider: "failed",
      error: error instanceof Error ? error.message : "IBM translation failed",
    };
  }
}
```

Failure must not block the emergency flow. If translation fails, continue with the original transcript.

---

## Where To Call It

Inside the ElevenLabs final transcript handler, before calling `/api/call/turn`:

```ts
const translated = await enrichTranscriptWithIbmTranslation({
  text: finalTranscriptText,
  providerLanguage: elevenLabsLanguage ?? null,
  isFinal: true,
});

const response = await fetch(`${baseUrl}/api/call/turn`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    incident_id,
    call_session_id,
    speaker: "caller",
    text: translated.original_text,
    is_final: true,
    language: translated.language,
    translated_text: translated.translated_text,
  }),
});
```

Then use only the backend response to decide what the voice layer says next:

```ts
const data = await response.json();
const sayToCaller = data?.data?.say_to_caller ?? "I want to make sure I understood. Can you briefly repeat what happened?";
```

---

## AI Pipeline Expectations For Member 3

Member 2 does not implement this, but should tell Member 3:

```text
When translated_text is present, the triage agent should use translated_text as the primary reasoning text.
The original text should remain available for audit/operator display.
Do not discard the caller's original language.
```

Example input to the AI layer:

```json
{
  "text": "Mi hijo está perdido cerca de la puerta 3.",
  "language": "es",
  "translated_text": "My child is lost near Gate 3."
}
```

Expected triage behavior:

```text
- identify possible lost child/person scenario;
- mark operator_required true if appropriate;
- ask for precise location or escalate based on current rules;
- keep response short and safe.
```

---

## Dashboard Expectations For Member 4

Member 2 should provide data so Member 4 can show:

```text
Caller Language: Spanish
Original Transcript: Mi hijo está perdido cerca de la puerta 3.
IBM Translation: My child is lost near Gate 3.
```

Member 4 should consume `TranscriptEvent.language` and `TranscriptEvent.translated_text` from existing transcript data sources once available.

Do not make Member 4 call IBM from the frontend.

---

## Demo Scripts For Phase 9

Use short, safe, repeatable scripts.

### Spanish — lost child/person near stadium gate

```text
Mi hijo está perdido cerca de la puerta 3.
```

Expected English translation:

```text
My child is lost near Gate 3.
```

Expected dashboard result:

```text
language = es
translated_text present
mode = world_cup
incident_type = lost_person or missing_person
operator_required = true or urgent depending on current triage rules
```

### French — medical help point request

```text
J'ai besoin d'aide médicale près de l'entrée principale.
```

Expected English translation:

```text
I need medical help near the main entrance.
```

Expected dashboard result:

```text
language = fr
translated_text present
mode = world_cup
incident_type = medical_assistance
operator_required based on severity
```

### English — no translation needed

```text
Someone stole my phone near the fan zone.
```

Expected dashboard result:

```text
language = en
translated_text = null
normal AI triage continues
```

---

## Definition Of Done

The IBM multilingual integration is done when:

```text
- IBM env vars are documented in `.env.example`.
- IBM credentials stay server-side only.
- Final transcript turns can be translated before `/api/call/turn`.
- `/api/call/turn` receives original `text`, `language`, and `translated_text`.
- If IBM fails, the call still proceeds with the original transcript.
- The dev voice simulator has at least two multilingual World Cup examples.
- Supabase or in-memory fallback stores transcript events with language/translated_text.
- Dashboard can later show original + translated transcript without contract changes.
- No direct Featherless/Gemma/Supabase/Mapbox calls are added to the voice wrapper.
```

---

## Cursor Prompt For Member 2

Use this prompt when implementing:

```text
I am Team Member 2: Voice + Telephony.

Read:
- docs/project_details.md
- docs/project_plan.md
- docs/api_contracts.md
- docs/team/member2_voice_telephony_agentic_integration_plan.md
- docs/team/member2_ibm_multilingual_translation_integration.md

Goal:
Add IBM Watson Language Translator as a server-side multilingual transcript enrichment layer.

Feature name:
IBM Multilingual Incident Layer.

Constraints:
- Do not replace ElevenLabs, Featherless/Gemma, Supabase, Twilio, or Mapbox.
- Do not call Featherless directly.
- Do not write Supabase directly from the voice wrapper.
- Do not change shared contracts unless absolutely necessary.
- Preserve original transcript text.
- Add language and translated_text to /api/call/turn payloads when available.
- Translate final transcript turns only, not partial turns.
- If IBM translation fails, continue with original text.
- Keep IBM API keys server-side only.

Suggested files:
- lib/voice/ibmLanguageTranslator.ts
- lib/voice/transcriptTranslation.ts
- app/api/elevenlabs/webhook/route.ts if it already exists or is being created
- components/dev/ElevenLabsVoiceSimulator.tsx only for multilingual demo examples
- .env.example

Definition of done:
- multilingual final transcript can reach /api/call/turn with language and translated_text
- English transcript still works unchanged
- IBM failure path does not break the call
- no frontend IBM call is introduced
- npm/type checks pass or targeted checks are documented
```
