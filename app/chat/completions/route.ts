/**
 * POST /chat/completions
 *
 * ElevenLabs Custom LLM webhook — proxies to the main elevenlabs webhook handler.
 * ElevenLabs hardcodes "/chat/completions" as the path suffix, so this route
 * forwards all requests to /api/elevenlabs/webhook.
 */
export { POST } from "@/app/api/elevenlabs/webhook/route";
