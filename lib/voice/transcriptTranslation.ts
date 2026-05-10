/**
 * Transcript translation wrapper — IBM Multilingual Incident Layer.
 *
 * Enriches final caller transcript turns with IBM Watson Language Translator
 * before they are sent to /api/call/turn.
 *
 * Rules:
 * - Only translates FINAL transcript turns (isFinal: true).
 * - Partial/interim turns are returned immediately with translation_provider: "none".
 * - Translation is disabled unless IBM_TRANSLATION_ENABLED=true.
 * - If IBM translation fails for ANY reason, the call continues unblocked
 *   with the original transcript text and translation_provider: "failed".
 * - Never writes to Supabase, never calls Featherless/Gemma directly.
 *
 * Usage:
 *   const translated = await enrichTranscriptWithIbmTranslation({
 *     text: finalCallerText,
 *     providerLanguage: elevenLabsLanguage ?? null,
 *     isFinal: true,
 *   });
 *
 *   // Then POST to /api/call/turn:
 *   {
 *     text: translated.original_text,
 *     language: translated.language,
 *     translated_text: translated.translated_text,
 *   }
 */

import { translateTextToEnglishWithIbm } from "./ibmLanguageTranslator";

export type TranslatedTranscript = {
  /** The caller's original text, always preserved. */
  original_text: string;
  /** Detected or provider-supplied BCP-47 language code (e.g. "es", "fr", "en"). */
  language: string | null;
  /** English translation, or null if not needed / not available. */
  translated_text: string | null;
  /**
   * Who produced the translation:
   * - "ibm_watson_language_translator" — IBM produced a translation
   * - "none"     — already English or partial turn, no translation needed
   * - "disabled" — IBM_TRANSLATION_ENABLED is not "true"
   * - "failed"   — IBM call threw, call continues with original text
   */
  translation_provider:
    | "ibm_watson_language_translator"
    | "none"
    | "disabled"
    | "failed";
  error?: string | null;
};

/**
 * Enrich a caller transcript turn with IBM language detection + translation.
 *
 * @param input.text            Raw transcript text from ElevenLabs.
 * @param input.providerLanguage BCP-47 language hint from ElevenLabs, if any.
 * @param input.isFinal         Only final turns get translated (saves quota).
 */
export async function enrichTranscriptWithIbmTranslation(input: {
  text: string;
  providerLanguage?: string | null;
  isFinal: boolean;
}): Promise<TranslatedTranscript> {
  const originalText = input.text.trim();

  // Non-final turns: skip translation entirely.
  if (!input.isFinal) {
    return {
      original_text: originalText,
      language: input.providerLanguage ?? null,
      translated_text: null,
      translation_provider: "none",
    };
  }

  // Feature flag: IBM_TRANSLATION_ENABLED must be explicitly "true".
  if (process.env.IBM_TRANSLATION_ENABLED !== "true") {
    return {
      original_text: originalText,
      language: input.providerLanguage ?? null,
      translated_text: null,
      translation_provider: "disabled",
    };
  }

  // Attempt IBM translation — never block the emergency call on failure.
  try {
    const result = await translateTextToEnglishWithIbm(originalText);

    return {
      original_text: originalText,
      language: result.sourceLanguage ?? input.providerLanguage ?? null,
      translated_text: result.translatedText,
      translation_provider: result.translatedText
        ? "ibm_watson_language_translator"
        : "none",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "IBM translation failed";
    console.error("[IBM] Translation error (non-blocking):", message);

    return {
      original_text: originalText,
      language: input.providerLanguage ?? null,
      translated_text: null,
      translation_provider: "failed",
      error: message,
    };
  }
}
