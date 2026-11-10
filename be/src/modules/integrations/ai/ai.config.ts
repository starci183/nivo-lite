import type { EnvSource } from "@modules/platform/config"
import type { AiOptions } from "./ai.options"
import { EMBEDDING_PROFILE } from "@nivo-lite/blocks-core"

const DEFAULT_CHAT_MODEL = "work"
/** The pinned OpenAI embeddings profile (`embed-oa`); the old `embed` (Qwen on OpenRouter) is gone from the pool. */
const DEFAULT_EMBEDDING_MODEL = EMBEDDING_PROFILE

/**
 * Reads the AI endpoint from the environment (BE-AI-3): `AI_BASE_URL`, the gateway the clients point at, with no default (a missing URL
 * would reach a provider directly), `STARCI_AI_KEY`, the virtual key `sk-starci-nivo-...` (a missing key would read `OPENAI_API_KEY`),
 * and `AI_CHAT_MODEL` / `AI_EMBEDDING_MODEL`, gateway profiles. The parse never refuses: without the URL and the key the app
 * boots, readiness stays red (`ReadinessService`) and every model call fails as unavailable. There is no second door to a model.
 */
export const parseAiConfig = (env: EnvSource): AiOptions => ({
    gatewayUrl: env.has("AI_BASE_URL") ? env.url("AI_BASE_URL") : null,
    virtualKey: env.has("STARCI_AI_KEY") ? env.secret("STARCI_AI_KEY") : null,
    chatModel: env.optional("AI_CHAT_MODEL") ?? DEFAULT_CHAT_MODEL,
    embeddingModel: env.optional("AI_EMBEDDING_MODEL") ?? DEFAULT_EMBEDDING_MODEL,
})
