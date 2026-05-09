/**
 * IBM Watson Language Translator client - REST API implementation.
 *
 * Uses direct HTTP calls instead of the ibm-watson SDK (which dropped
 * Language Translator support). No SDK dependency required.
 *
 * Part of the "IBM Multilingual Incident Layer" feature.
 * Server-side only. Never import from frontend.
 *
 * Required env vars:
 *   IBM_LANGUAGE_TRANSLATOR_API_KEY
 *   IBM_LANGUAGE_TRANSLATOR_URL
 *   IBM_LANGUAGE_TRANSLATOR_VERSION  (default: 2018-05-01)
 *   IBM_TRANSLATION_TARGET_LANGUAGE  (default: en)
 */

export type IbmTranslationResult = {
  sourceLanguage: string | null;
  translatedText: string | null;
  provider: "ibm_watson_language_translator";
};

const IBM_TIMEOUT_MS = 5000;

function getConfig() {
  return {
    apiKey: process.env.IBM_LANGUAGE_TRANSLATOR_API_KEY?.trim() ?? "",
    serviceUrl: process.env.IBM_LANGUAGE_TRANSLATOR_URL?.trim() ?? "",
    version: process.env.IBM_LANGUAGE_TRANSLATOR_VERSION?.trim() ?? "2018-05-01",
    targetLanguage: process.env.IBM_TRANSLATION_TARGET_LANGUAGE?.trim() ?? "en",
  };
}

function buildAuthHeader(apiKey: string): string {
  const credentials = Buffer.from("apikey:" + apiKey).toString("base64");
  return "Basic " + credentials;
}

async function identifyLanguage(
  text: string,
  config: ReturnType<typeof getConfig>
): Promise<string | null> {
  const url = config.serviceUrl + "/v3/identify?version=" + encodeURIComponent(config.version);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IBM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(config.apiKey),
        "Content-Type": "text/plain",
        Accept: "application/json",
      },
      body: text,
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error("IBM identify HTTP " + response.status + ": " + body.slice(0, 200));
    }
    const data = (await response.json()) as {
      languages?: Array<{ language: string; confidence: number }>;
    };
    return data.languages?.[0]?.language ?? null;
  } finally {
    clearTimeout(timer);
  }
}

async function translateText(
  text: string,
  sourceLanguage: string,
  config: ReturnType<typeof getConfig>
): Promise<string | null> {
  const url = config.serviceUrl + "/v3/translate?version=" + encodeURIComponent(config.version);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IBM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(config.apiKey),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ text: [text], source: sourceLanguage, target: config.targetLanguage }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error("IBM translate HTTP " + response.status + ": " + body.slice(0, 200));
    }
    const data = (await response.json()) as {
      translations?: Array<{ translation: string }>;
    };
    return data.translations?.[0]?.translation ?? null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Translate text to the target language via IBM Language Translator REST API.
 * Returns null fields when credentials are missing, text is empty, or language
 * is already the target. Throws on network/API errors so callers can fall back.
 */
export async function translateTextToEnglishWithIbm(
  text: string
): Promise<IbmTranslationResult> {
  const config = getConfig();
  const base: IbmTranslationResult = {
    sourceLanguage: null,
    translatedText: null,
    provider: "ibm_watson_language_translator",
  };
  if (!config.apiKey || !config.serviceUrl) return base;
  const trimmed = text.trim();
  if (!trimmed) return base;

  const sourceLanguage = await identifyLanguage(trimmed, config);
  if (!sourceLanguage || sourceLanguage === config.targetLanguage) {
    return { ...base, sourceLanguage: sourceLanguage ?? config.targetLanguage };
  }

  const translatedText = await translateText(trimmed, sourceLanguage, config);
  return { sourceLanguage, translatedText, provider: "ibm_watson_language_translator" };
}
