import { Secret } from "@modules/platform/config"
import type { EnvSource } from "@modules/platform/config"
import type { LlmEndpoint, LlmOptions } from "./llm.options"

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
const DEFAULT_EMBEDDING_MODEL = "qwen/qwen3-embedding-8b"
const DEFAULT_CHAT_MODEL = "deepseek/deepseek-chat"

const firstDeclared = (env: EnvSource, keys: ReadonlyArray<string>): Secret | null => {
    for (const key of keys) {
        const value = env.optional(key)
        if (value !== undefined) return new Secret(value)
    }
    return null
}

const baseUrlOf = (env: EnvSource, key: string): string => {
    const declared = env.optional(key)
    if (declared === undefined) return DEFAULT_BASE_URL
    if (!URL.canParse(declared) || !/^https?:$/u.test(new URL(declared).protocol)) {
        return DEFAULT_BASE_URL
    }
    let end = declared.length
    while (end > 0 && declared[end - 1] === "/") end -= 1
    return declared.slice(0, end)
}

const endpointOf = (
    env: EnvSource,
    keys: ReadonlyArray<string>,
    baseUrlKey: string,
    modelKey: string,
    fallbackModel: string,
): LlmEndpoint => ({
    apiKey: firstDeclared(env, keys),
    baseUrl: baseUrlOf(env, baseUrlKey),
    model: env.optional(modelKey) ?? fallbackModel,
})

/**
 * Reads the language-model options. Nothing here is required: without a key the capability answers nothing and callers fall back
 * (passages are stored with no vector and found by keyword; no fact is read out of a document).
 */
export const parseLlmConfig = (env: EnvSource): LlmOptions => ({
    embedding: endpointOf(
        env,
        ["EMBEDDING_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY", "DEEPSEEK_API_KEY"],
        "EMBEDDING_BASE_URL",
        "EMBEDDING_MODEL",
        DEFAULT_EMBEDDING_MODEL,
    ),
    chat: endpointOf(
        env,
        ["LLM_API_KEY", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY"],
        "LLM_BASE_URL",
        "LLM_MODEL",
        DEFAULT_CHAT_MODEL,
    ),
})
