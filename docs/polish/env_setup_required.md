# Required environment setup (ECC)

Inventory derived from repository scans for `process.env.` / `NEXT_PUBLIC_` in `*.ts`, `*.tsx`, `*.js`, `*.mjs` (excluding test-only mutations). **There is no `GEMINI_API_KEY` in this codebase** — Google Gemma triage/voice uses **`GEMMA_API_KEY`** and **`GEMMA_MODEL`** against the Generative Language API.

Copy [.env.example](../../.env.example) to `.env.local`. Never commit secrets.

---

## Minimum local demo env

Enough to load the **dashboard map** and run **mock/deterministic triage** (`AI_PROVIDER=mock`) without Supabase or telephony:

```env
# Map (browser — shipped to client; use URL-restricted public token)
NEXT_PUBLIC_MAPBOX_TOKEN=your_real_mapbox_token

# Triage without external LLM
AI_PROVIDER=mock
```

### Minimum + dashboard realtime + durable API persistence

Add Supabase URL plus **either** publishable **or** legacy anon key for the browser, and **service role** on the server for writes:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

*(Legacy: `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of publishable — see [lib/supabase/env.ts](../../lib/supabase/env.ts).)*

### Mapbox MCP–backed geocode (server triage tool)

Map UI and MCP geocode use **different** env vars. **`NEXT_PUBLIC_MAPBOX_TOKEN`** feeds the Mapbox GL client; **`MAPBOX_*`** configures the hosted MCP JSON-RPC client used by [`lib/mcp/mapboxMcpClient.ts`](../../lib/mcp/mapboxMcpClient.ts) / [`lib/tools/mapbox/mapboxToolConfig.ts`](../../lib/tools/mapbox/mapboxToolConfig.ts). You may reuse the **same Mapbox token value** for both in development if your token scopes allow.

```env
NEXT_PUBLIC_MAPBOX_TOKEN=your_real_mapbox_token
MAPBOX_MCP_ENABLED=true
MAPBOX_ACCESS_TOKEN=your_real_mapbox_token
MAPBOX_MCP_URL=https://mcp.mapbox.com/mcp
MAPBOX_MCP_TIMEOUT_MS=5000
```

If `MAPBOX_MCP_ENABLED` is not `true` or `MAPBOX_ACCESS_TOKEN` is empty, [`geocodeWithMapboxMcp`](../../lib/tools/mapbox/geocodeWithMapboxMcp.ts) reports unavailable/error and [`geocodeLocation`](../../lib/tools/geocodeLocation.ts) falls back to mock/static coordinates.

---

## Reference tables

Legend:

- **Scope:** **Browser** = embedded in client bundle (`NEXT_PUBLIC_*`). **Server** = route handlers, server components, Node-only libs — never expose to the client.
- **Required:** **Yes** only when you need that feature in production-like demos; otherwise **Optional**.

### Supabase

| Variable | Used in | Required | Allowed / default | Feature | If missing |
|----------|---------|----------|-------------------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | [`lib/supabase/env.ts`](../../lib/supabase/env.ts), [`lib/supabase/service.ts`](../../lib/supabase/service.ts), [`lib/supabase/middleware.ts`](../../lib/supabase/middleware.ts) (via `getSupabaseUrl`), [`app/api/dev/db-health/route.ts`](../../app/api/dev/db-health/route.ts), [`lib/supabase/client.ts`](../../lib/supabase/client.ts) (error message), [`lib/supabase/server.ts`](../../lib/supabase/server.ts) | Optional | Valid Supabase project URL | Browser/middleware SSR client; echoed in db-health | No cookie refresh path; middleware no-ops ([`updateSession`](../../lib/supabase/middleware.ts)); server client creation errors if code path still invoked |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | [`lib/supabase/env.ts`](../../lib/supabase/env.ts) (`getSupabaseAnonKey` prefers this) | Optional* | Supabase publishable key | Dashboard anon reads + realtime | Falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`; if both missing, browser Supabase client throws when used |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | [`lib/supabase/env.ts`](../../lib/supabase/env.ts) | Optional* | Legacy anon key | Same as publishable | Used only if publishable unset |
| `SUPABASE_SERVICE_ROLE_KEY` | [`lib/supabase/service.ts`](../../lib/supabase/service.ts) | Optional | Service role secret | `getServiceRoleClient()` writes (RLS bypass) | `getServiceRoleClient()` returns `null` → [`demo-store`](../../lib/server/demo-store.ts) persistence for API routes |

*At least one of publishable or anon key is required **when** instantiating the browser Supabase client.

### Mapbox (map + MCP)

| Variable | Used in | Required | Allowed / default | Feature | If missing |
|----------|---------|----------|-------------------|---------|------------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | [`components/map/CommandMap.tsx`](../../components/map/CommandMap.tsx) | Optional | Mapbox access token (restrict by URL in Mapbox account) | Mapbox GL map | [`CommandMapOffline`](../../components/map/CommandMapOffline.tsx) / offline UX |
| `MAPBOX_MCP_ENABLED` | [`lib/tools/mapbox/mapboxToolConfig.ts`](../../lib/tools/mapbox/mapboxToolConfig.ts) | Optional | Must be exactly `true` to enable MCP | Backend geocode via MCP | Treated as disabled → MCP unavailable |
| `MAPBOX_ACCESS_TOKEN` | [`lib/tools/mapbox/mapboxToolConfig.ts`](../../lib/tools/mapbox/mapboxToolConfig.ts) | Optional when MCP on | Non-empty string; Bearer token for MCP | MCP HTTP auth | If MCP enabled but empty → MCP unavailable ([`getMapboxMcpAvailability`](../../lib/tools/mapbox/mapboxToolConfig.ts)) |
| `MAPBOX_MCP_URL` | [`lib/tools/mapbox/mapboxToolConfig.ts`](../../lib/tools/mapbox/mapboxToolConfig.ts) | Optional | Default `https://mcp.mapbox.com/mcp` | MCP endpoint | Default used |
| `MAPBOX_MCP_TIMEOUT_MS` | [`lib/tools/mapbox/mapboxToolConfig.ts`](../../lib/tools/mapbox/mapboxToolConfig.ts) | Optional | Positive number; default `5000` | MCP request timeout | Default `5000` |

### Triage / GeoOps providers

| Variable | Used in | Required | Allowed / default | Feature | If missing |
|----------|---------|----------|-------------------|---------|------------|
| `AI_PROVIDER` | [`lib/ai/agents/callTriageAgent.ts`](../../lib/ai/agents/callTriageAgent.ts), [`lib/db/call-repository.ts`](../../lib/db/call-repository.ts), [`lib/simulate/voice-sim-triage-server.ts`](../../lib/simulate/voice-sim-triage-server.ts), [`app/api/elevenlabs/webhook/route.ts`](../../app/api/elevenlabs/webhook/route.ts) (metadata) | Optional | `mock`, `featherless`, `gemma` (case-insensitive; unknown → `mock`) | Call triage provider selection | Defaults to **`mock`** in agent normalizer |
| `GEOOPS_PROVIDER` | [`lib/surge/buildSurgeGeoOpsAgentInput.ts`](../../lib/surge/buildSurgeGeoOpsAgentInput.ts) (`resolveGeoOpsProvider`) | Optional | Any non-empty string | GeoOps agent input `provider` field | Falls back to `AI_PROVIDER`, then `null` |

### Featherless

| Variable | Used in | Required | Allowed / default | Feature | If missing |
|----------|---------|----------|-------------------|---------|------------|
| `FEATHERLESS_API_KEY` | [`lib/ai/providers/featherlessClient.ts`](../../lib/ai/providers/featherlessClient.ts), [`lib/ai/agents/callTriageAgent.ts`](../../lib/ai/agents/callTriageAgent.ts), [`app/api/elevenlabs/webhook/route.ts`](../../app/api/elevenlabs/webhook/route.ts) | Required for Featherless triage/voice | Non-empty secret | Structured triage JSON; EL voice reads key in webhook | Triage: mock fallback + `provider_error`; webhook: voice path degrades per handler |
| `FEATHERLESS_MODEL` | Same + webhook defaults model `google/gemma-3-4b-it` in [`route.ts`](../../app/api/elevenlabs/webhook/route.ts) | Required for Featherless **triage** (`callTriageAgent` requires model) | Model id string | Triage completions | Triage falls back to mock if unset (agent path); webhook supplies default for its own reads |
| `FEATHERLESS_BASE_URL` | [`lib/ai/providers/featherlessClient.ts`](../../lib/ai/providers/featherlessClient.ts), webhook | Optional | Normalized API base; default Featherless cloud | API endpoint | Client normalizes default |
| `FEATHERLESS_JSON_RESPONSE` | [`lib/ai/providers/featherlessClient.ts`](../../lib/ai/providers/featherlessClient.ts) | Optional | Set to `1` to alter JSON response mode | Featherless HTTP behavior | Default off |
| `FEATHERLESS_HTTP_REFERER` | [`lib/ai/providers/featherlessClient.ts`](../../lib/ai/providers/featherlessClient.ts) | Optional | URL string | Optional HTTP header | Not sent |
| `FEATHERLESS_X_TITLE` | [`lib/ai/providers/featherlessClient.ts`](../../lib/ai/providers/featherlessClient.ts) | Optional | Short string | Optional HTTP header | Not sent |

### Gemma (Google Generative Language API)

| Variable | Used in | Required | Allowed / default | Feature | If missing |
|----------|---------|----------|-------------------|---------|------------|
| `GEMMA_API_KEY` | [`lib/ai/providers/gemmaClient.ts`](../../lib/ai/providers/gemmaClient.ts), [`lib/ai/agents/callTriageAgent.ts`](../../lib/ai/agents/callTriageAgent.ts) | Required when `AI_PROVIDER=gemma` | API key | Triage JSON + `generateVoiceReplyViaGemma` | Triage mock fallback; voice helper throws if called without key |
| `GEMMA_MODEL` | [`lib/ai/providers/gemmaClient.ts`](../../lib/ai/providers/gemmaClient.ts) | Optional | Default `gemma-4-26b-a4b-it` (see `DEFAULT_GEMMA_MODEL`) | Model id in API URL | Default model used |

### Twilio

| Variable | Used in | Required | Allowed / default | Feature | If missing |
|----------|---------|----------|-------------------|---------|------------|
| `TWILIO_ACCOUNT_SID` | [`lib/voice/voiceConfig.ts`](../../lib/voice/voiceConfig.ts) | Optional | Account SID | Twilio REST + PSTN | `twilioConfig.isConfigured` false → stubs |
| `TWILIO_AUTH_TOKEN` | [`lib/voice/voiceConfig.ts`](../../lib/voice/voiceConfig.ts) | Optional | Auth token | Twilio REST | Same |
| `TWILIO_PHONE_NUMBER` | [`lib/voice/voiceConfig.ts`](../../lib/voice/voiceConfig.ts) | Optional | E.164 | Inbound number | Same |
| `TWILIO_OPERATOR_FORWARD_NUMBER` | [`lib/voice/voiceConfig.ts`](../../lib/voice/voiceConfig.ts) | Optional | E.164 | Primary transfer target | `resolveOperatorForwardE164` returns empty string |
| `TWILIO_OPERATOR_FORWARD_NUMBER_ALT` | [`lib/voice/voiceConfig.ts`](../../lib/voice/voiceConfig.ts) | Optional | E.164 | Alt queue (disaster / world_cup) | Falls back to primary |

### ElevenLabs

| Variable | Used in | Required | Allowed / default | Feature | If missing |
|----------|---------|----------|-------------------|---------|------------|
| `ELEVENLABS_API_KEY` | [`lib/voice/voiceConfig.ts`](../../lib/voice/voiceConfig.ts) | Optional | API key | Agent API | `elevenLabsConfig.isConfigured` false |
| `ELEVENLABS_AGENT_ID` | [`lib/voice/voiceConfig.ts`](../../lib/voice/voiceConfig.ts) | Optional | Agent UUID | Conversational AI | Same |
| `ELEVENLABS_WEBHOOK_SECRET` | [`lib/voice/voiceConfig.ts`](../../lib/voice/voiceConfig.ts) | Optional | HMAC secret | Webhook verification | Empty → verification skipped ([`verifyElevenLabsSignature`](../../lib/voice/elevenlabsWebhookParser.ts) behavior per implementation) |

### IBM / watsonx (translation)

| Variable | Used in | Required | Allowed / default | Feature | If missing |
|----------|---------|----------|-------------------|---------|------------|
| `IBM_TRANSLATION_ENABLED` | [`lib/voice/transcriptTranslation.ts`](../../lib/voice/transcriptTranslation.ts), [`app/api/elevenlabs/webhook/route.ts`](../../app/api/elevenlabs/webhook/route.ts) | Optional | Must be exactly `true` to enable | IBM translation layer | Translation disabled |
| `IBM_WATSONX_API_KEY` | [`lib/voice/ibmLanguageTranslator.ts`](../../lib/voice/ibmLanguageTranslator.ts) | Required when IBM translation used | IAM API key | watsonx auth | Empty strings in config |
| `IBM_WATSONX_PROJECT_ID` | [`lib/voice/ibmLanguageTranslator.ts`](../../lib/voice/ibmLanguageTranslator.ts) | Required when IBM translation used | Project GUID | watsonx | Empty |
| `IBM_WATSONX_URL` | [`lib/voice/ibmLanguageTranslator.ts`](../../lib/voice/ibmLanguageTranslator.ts) | Optional | Default `https://us-south.ml.cloud.ibm.com` | Service URL | Default |
| `IBM_WATSONX_MODEL_ID` | [`lib/voice/ibmLanguageTranslator.ts`](../../lib/voice/ibmLanguageTranslator.ts) | Optional | Default `ibm/granite-3-8b-instruct` | Model | Default |
| `IBM_TRANSLATION_TARGET_LANGUAGE` | [`lib/voice/ibmLanguageTranslator.ts`](../../lib/voice/ibmLanguageTranslator.ts) | Optional | Default `en` | Target language code | Default |

### Advisory operator runtime (polish)

| Variable | Used in | Required | Allowed / default | Feature | If missing |
|----------|---------|----------|-------------------|---------|------------|
| `OPERATOR_AVAILABILITY` | [`lib/server/operatorAvailability.ts`](../../lib/server/operatorAvailability.ts) | Optional | `free` (default) or `busy` | Transfer gate + advisory assignment narrative | Defaults to `free` |
| `OPERATOR_ASSIGNMENT_SOURCE` | [`lib/server/operatorAvailability.ts`](../../lib/server/operatorAvailability.ts) | Optional | `env` (default) or `unavailable` | Synthetic operator list for `runEmergencyTurn` | `unavailable` → `operator_assignment: null` + validation warning |

### Debug / dev server

| Variable | Used in | Required | Allowed / default | Feature | If missing |
|----------|---------|----------|-------------------|---------|------------|
| `ECC_VOICE_DEBUG` | [`app/api/call/turn/route.ts`](../../app/api/call/turn/route.ts), [`app/api/elevenlabs/webhook/route.ts`](../../app/api/elevenlabs/webhook/route.ts), [`lib/server/merge-triage-output.ts`](../../lib/server/merge-triage-output.ts) | Optional | `true` enables debug | Extra logging / diagnostics | Debug off |
| `PORT` | [`app/api/elevenlabs/webhook/chat/completions/route.ts`](../../app/api/elevenlabs/webhook/chat/completions/route.ts) | Optional | Default `3000` | Internal fetch base for EL shim | `3000` |

---

## Browser-safe vs server-only

| Scope | Variables |
|-------|-----------|
| **Browser (never put secrets here)** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN` |
| **Server-only (secrets)** | `SUPABASE_SERVICE_ROLE_KEY`, all `TWILIO_*`, `ELEVENLABS_*`, `FEATHERLESS_API_KEY`, `GEMMA_API_KEY`, `MAPBOX_ACCESS_TOKEN`, `IBM_WATSONX_*`, `ELEVENLABS_WEBHOOK_SECRET` |
| **Server-only (non-secret toggles)** | `AI_PROVIDER`, `GEOOPS_PROVIDER`, `MAPBOX_MCP_ENABLED`, `MAPBOX_MCP_URL`, `MAPBOX_MCP_TIMEOUT_MS`, `IBM_TRANSLATION_ENABLED`, `IBM_TRANSLATION_TARGET_LANGUAGE`, `OPERATOR_AVAILABILITY`, `OPERATOR_ASSIGNMENT_SOURCE`, `ECC_VOICE_DEBUG`, `PORT`, and non-key Featherless headers / base URL toggles |

---

## Related docs

- [final_verification_checklist.md](./final_verification_checklist.md) — manual verification matrix.
- [lib/voice/voiceConfig.ts](../../lib/voice/voiceConfig.ts) — Twilio / ElevenLabs comments.
- [lib/tools/mapbox/mapboxToolConfig.ts](../../lib/tools/mapbox/mapboxToolConfig.ts) — MCP env parsing.
