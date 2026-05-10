/**
 * ElevenLabs Custom LLM — chat completions proxy
 *
 * ElevenLabs appends /chat/completions to whatever base URL you set in the
 * Custom LLM field. This handler forwards every request to the main webhook
 * so both paths behave identically:
 *   POST /api/elevenlabs/webhook                    (post-call, transcript events)
 *   POST /api/elevenlabs/webhook/chat/completions   (Custom LLM per-turn calls)
 *
 * Using an internal forward instead of a re-export avoids Turbopack's
 * restriction on importing from other route files. The native fetch Response
 * is returned directly, so SSE streaming is preserved end-to-end.
 */
export const POST = async (request: Request): Promise<Response> => {
  const rawBody = await request.text();

  // Always use localhost so the internal forward never loops through the
  // public tunnel (ngrok / cloudflared). Deriving the URL from request.url
  // would give the tunnel's HTTPS address, causing ERR_SSL_PACKET_LENGTH_TOO_LONG.
  const port = process.env.PORT ?? "3000";
  const mainUrl = `http://localhost:${port}/api/elevenlabs/webhook`;

  // Forward all original headers (preserves ElevenLabs signature headers)
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Return the upstream Response directly — supports JSON and SSE streaming
  return fetch(mainUrl, { method: "POST", headers, body: rawBody });
};
