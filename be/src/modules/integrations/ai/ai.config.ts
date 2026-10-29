import type { EnvSource } from "@modules/platform/config"
import type { AiOptions } from "./ai.options"

const DEFAULT_CHAT_MODEL = "work"
const DEFAULT_EMBEDDING_MODEL = "embed"

/**
 * Reads the AI endpoint from the environment (BE-AI-3): `AI_BASE_URL`, the gateway the clients point at, with no default (a missing URL
 * would reach a provider directly), `AI_API_KEY`, the virtual key `sk-starci-...` (a missing key would read `OPENAI_API_KEY`),
 * and `AI_CHAT_MODEL` / `AI_EMBEDDING_MODEL`, gateway profiles. None is required: without the URL and the key the app boots, the
 * service answers unavailable and callers fall back (keyword search, template messages).
 */
export const parseAiConfig = (env: EnvSource): AiOptions => ({
    gatewayUrl: env.has("AI_BASE_URL") ? env.url("AI_BASE_URL") : null,
    virtualKey: env.has("AI_API_KEY") ? env.secret("AI_API_KEY") : null,
    chatModel: env.optional("AI_CHAT_MODEL") ?? DEFAULT_CHAT_MODEL,
    embeddingModel: env.optional("AI_EMBEDDING_MODEL") ?? DEFAULT_EMBEDDING_MODEL,
})
