import type { CallSession, Incident, TranscriptEvent } from "@/lib/types";

export type MultilingualSummaryItem = {
  label: string;
  value: string;
  tone?: "default" | "info" | "warning";
};

export type MultilingualSummary = {
  caller_language: MultilingualSummaryItem;
  original_transcript: MultilingualSummaryItem;
  english_transcript: MultilingualSummaryItem;
  ai_reply_language: MultilingualSummaryItem;
  operator_summary: MultilingualSummaryItem;
  translation_status: MultilingualSummaryItem;
  details_available: boolean;
  notes: string[];
};

type BuildMultilingualSummaryInput = {
  incident: Incident;
  activeCallSession?: CallSession | null;
  transcriptEvents?: TranscriptEvent[] | null;
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  it: "Italian",
  ar: "Arabic",
  hi: "Hindi",
  ur: "Urdu",
  zh: "Chinese",
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const formatLanguageLabel = (value: string | null): string => {
  if (!value) {
    return "Not available";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return "Not available";
  }

  const baseCode = normalized.split(/[-_]/)[0] ?? normalized;
  const languageName = LANGUAGE_LABELS[baseCode];
  return languageName ? `${languageName} (${normalized})` : normalized;
};

const latestMatchingEvent = (
  transcriptEvents: TranscriptEvent[],
  predicate: (event: TranscriptEvent) => boolean,
): TranscriptEvent | null => {
  const matches = transcriptEvents.filter(predicate);
  return matches.length > 0 ? matches[matches.length - 1]! : null;
};

export const buildMultilingualSummary = ({
  incident,
  transcriptEvents = null,
}: BuildMultilingualSummaryInput): MultilingualSummary => {
  const events = Array.isArray(transcriptEvents) ? transcriptEvents : [];
  const callerLanguageFromIncident = asNonEmptyString(
    incident.collected_fields.caller_language,
  );
  const callerLanguageFromEvents =
    latestMatchingEvent(events, (event) => Boolean(asNonEmptyString(event.language)))
      ?.language ?? null;
  const callerLanguage = callerLanguageFromEvents ?? callerLanguageFromIncident;

  const latestCallerTranscript =
    latestMatchingEvent(
      events,
      (event) =>
        event.speaker === "caller" && Boolean(asNonEmptyString(event.text)),
    ) ??
    latestMatchingEvent(events, (event) => Boolean(asNonEmptyString(event.text)));

  const latestTranslatedTranscript = latestMatchingEvent(
    events,
    (event) => Boolean(asNonEmptyString(event.translated_text)),
  );

  const hasTranscriptFeed = events.length > 0;
  const hasTranslation = Boolean(
    latestTranslatedTranscript?.translated_text &&
      latestTranslatedTranscript.translated_text.trim().length > 0,
  );
  const hasLanguageSignal = Boolean(callerLanguage);
  const detailsAvailable =
    hasLanguageSignal || Boolean(latestCallerTranscript) || hasTranslation;

  const notes: string[] = [];

  if (hasTranslation) {
    notes.push("English translation is available for this incident's live transcript.");
  } else if (hasTranscriptFeed && hasLanguageSignal) {
    notes.push(
      "A caller language is available, but no translated English transcript is present in the loaded events.",
    );
  } else if (!hasTranscriptFeed) {
    notes.push("Live transcript translation details are not loaded in this drawer view.");
  }

  if (!detailsAvailable) {
    notes.push("Multilingual details not available for this incident yet.");
  }

  return {
    caller_language: {
      label: "Caller language",
      value: formatLanguageLabel(callerLanguage),
      tone: hasLanguageSignal ? "info" : "default",
    },
    original_transcript: {
      label: "Original caller transcript",
      value: latestCallerTranscript?.text?.trim()
        ? latestCallerTranscript.text.trim()
        : hasTranscriptFeed
          ? "No caller transcript text is available in the loaded events."
          : "Live transcript details not loaded in this view.",
      tone: latestCallerTranscript ? "info" : "default",
    },
    english_transcript: {
      label: "English transcript",
      value: latestTranslatedTranscript?.translated_text?.trim()
        ? latestTranslatedTranscript.translated_text.trim()
        : hasTranscriptFeed
          ? "No English translation is available in the loaded transcript events."
          : "Not available in this view.",
      tone: hasTranslation ? "info" : "default",
    },
    ai_reply_language: {
      label: "AI reply language",
      value: "Not available",
      tone: "default",
    },
    operator_summary: {
      label: "Operator-facing English summary",
      value: "Not available",
      tone: "default",
    },
    translation_status: {
      label: "Translation status",
      value: hasTranslation
        ? "Available"
        : hasTranscriptFeed
          ? "Unavailable"
          : "Unknown",
      tone: hasTranslation ? "info" : hasTranscriptFeed ? "warning" : "default",
    },
    details_available: detailsAvailable,
    notes,
  };
};
