// Run with: node scripts/list-gemma-models.mjs
// Lists all models available to your GEMMA_API_KEY that support generateContent

import { readFileSync } from "fs";
import { resolve } from "path";

// Read API key from .env.local
const envPath = resolve(process.cwd(), ".env.local");
const env = readFileSync(envPath, "utf8");
const keyMatch = env.match(/GEMMA_API_KEY=(.+)/);
const key = keyMatch?.[1]?.trim();

if (!key) {
  console.error("GEMMA_API_KEY not found in .env.local");
  process.exit(1);
}

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
);
const data = await res.json();

if (data.error) {
  console.error("API error:", data.error.message);
  process.exit(1);
}

const models = (data.models ?? []).filter((m) =>
  m.supportedGenerationMethods?.includes("generateContent")
);

console.log(`\n✅ ${models.length} models available for generateContent:\n`);
models.forEach((m) => {
  console.log(`  ${m.name.replace("models/", "").padEnd(40)} ${m.displayName}`);
});
