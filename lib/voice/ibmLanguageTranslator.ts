/**
 * IBM watsonx.ai translation client.
 *
 * Replaces the deprecated IBM Watson Language Translator (withdrawn Dec 2024).
 * Uses watsonx.ai text generation with a structured translation prompt.
 * IBM IAM token is cached in memory to avoid re-fetching on every call.
 *
 * Part of the "IBM Multilingual Incident Layer" feature.
 * Server-side only. Never import from frontend.
 *
 * Required env vars:
 *   IBM_WATSONX_API_KEY
 *   IBM_WATSONX_PROJECT_ID
 *   IBM_WATSONX_URL              (default: https://us-south.ml.cloud.ibm.com)
 *   IBM_WATSONX_MODEL_ID         (default: ibm/granite-3-8b-instruct)
 *   IBM_TRANSLATION_TARGET_LANGUAGE  (default: en)
 */

export type IbmTranslationResult = {
  sourceLanguage: string | null;
  translatedText: string | null;
  provider: "ibm_watson_language_translator";
};

const IBM_TIMEOUT_MS = 8000;
const IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token";

// In-memory IAM token cache (module scope — survives across requests in the same server process)
let _cachedToken: { token: string; expiresAt: number } | null = null;

function getConfig() {
  return {
    apiKey: process.env.IBM_WATSONX_API_KEY?.trim() ?? "",
    projectId: process.env.IBM_WATSONX_PROJECT_ID?.trim() ?? "",
    serviceUrl: process.env.IBM_WATSONX_URL?.trim() ?? "https://us-south.ml.cloud.ibm.com",
    modelId: process.env.IBM_WATSONX_MODEL_ID?.trim() ?? "ibm/granite-3-8b-instruct",
    targetLanguage: process.env.IBM_TRANSLATION_TARGET_LANGUAGE?.trim() ?? "en",
  };
}

async function getIamToken(apiKey: string): Promise<string> {
  // Return cached token if still valid (60s buffer before expiry)
  if (_cachedToken && _cachedToken.expiresAt > Date.now() + 60_000) {
    return _cachedToken.token;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IBM_TIMEOUT_MS);
  try {
    const response = await fetch(IAM_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`,
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error("IBM IAM token HTTP " + response.status + ": " + body.slice(0, 200));
    }
    const data = (await response.json()) as { access_token: string; expires_in: number };
    _cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return _cachedToken.token;
  } finally {
    clearTimeout(timer);
  }
}

async function callWatsonxTranslate(
  text: string,
  token: string,
  config: ReturnType<typeof getConfig>
): Promise<{ language: string | null; translation: string | null }> {
  const url = config.serviceUrl + "/ml/v1/text/generation?version=2023-05-29";

  const prompt =
    `Detect the language of the text below and translate it to English.\n` +
    `Return ONLY a JSON object with exactly two fields:\n` +
    `- "language": ISO 639-1 code of the input (e.g. "es", "fr", "de", "en")\n` +
    `- "translation": the English translation, or null if already in English\n\n` +
    `Text: ${text}\n\nJSON:`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IBM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        model_id: config.modelId,
        input: prompt,
        parameters: { max_new_tokens: 150, temperature: 0.0 },
        project_id: config.projectId,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error("watsonx.ai HTTP " + response.status + ": " + body.slice(0, 200));
    }
    const data = (await response.json()) as {
      results?: Array<{ generated_text?: string }>;
    };
    const raw = data.results?.[0]?.generated_text?.trim() ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("watsonx.ai returned no JSON: " + raw.slice(0, 100));
    const parsed = JSON.parse(match[0]) as { language?: string; translation?: string | null };
    return { language: parsed.language ?? null, translation: parsed.translation ?? null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Translate English text into a target language via IBM watsonx.ai.
 * Used to localise the agent's reply back into the caller's language.
 * Returns null on any failure so the caller can fall back to English.
 */
export async function translateEnglishToLanguageWithIbm(
  text: string,
  targetLanguageCode: string // ISO 639-1, e.g. "es", "hi", "fr"
): Promise<string | null> {
  const config = getConfig();
  if (!config.apiKey || !config.projectId) return null;
  const trimmed = text.trim();
  if (!trimmed || targetLanguageCode === "en") return null;

  const ISO_TO_LANGUAGE: Record<string, string> = {
    es: "Spanish", fr: "French", pt: "Portuguese", de: "German",
    it: "Italian", nl: "Dutch", pl: "Polish", ru: "Russian",
    uk: "Ukrainian", ar: "Arabic", fa: "Farsi", tr: "Turkish",
    hi: "Hindi", bn: "Bengali", ur: "Urdu", pa: "Punjabi",
    gu: "Gujarati", ta: "Tamil", te: "Telugu", ml: "Malayalam",
    kn: "Kannada", mr: "Marathi", ne: "Nepali", si: "Sinhala",
    th: "Thai", vi: "Vietnamese", id: "Indonesian", ms: "Malay",
    tl: "Filipino", zh: "Chinese", ja: "Japanese", ko: "Korean",
    sw: "Swahili", am: "Amharic", ha: "Hausa", yo: "Yoruba",
    ig: "Igbo", so: "Somali", om: "Oromo",
  };
  const langName = ISO_TO_LANGUAGE[targetLanguageCode] ?? targetLanguageCode;

  try {
    const token = await getIamToken(config.apiKey);
    const url = config.serviceUrl + "/ml/v1/text/generation?version=2023-05-29";
    const prompt =
      `Translate the following English text into ${langName}.\n` +
      `Return ONLY the translated text, no explanations, no JSON, no quotes.\n\n` +
      `English: ${trimmed}\n\n${langName}:`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IBM_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          model_id: config.modelId,
          input: prompt,
          parameters: { max_new_tokens: 200, temperature: 0.0 },
          project_id: config.projectId,
        }),
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { results?: Array<{ generated_text?: string }> };
      const result = data.results?.[0]?.generated_text?.trim() ?? "";
      return result || null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/**
 * Translate text to English via IBM watsonx.ai.
 * Returns null fields when credentials are missing or text is empty.
 * Throws on network/API errors so callers (transcriptTranslation.ts) can fall back.
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
  if (!config.apiKey || !config.projectId) return base;
  const trimmed = text.trim();
  if (!trimmed) return base;

  const token = await getIamToken(config.apiKey);
  const result = await callWatsonxTranslate(trimmed, token, config);

  return {
    sourceLanguage: result.language,
    translatedText: result.language === "en" ? null : result.translation,
    provider: "ibm_watson_language_translator",
  };
}
