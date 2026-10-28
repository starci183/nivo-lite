import { Secret } from "@modules/platform/config"
import type { AiPoolKey, AiPoolOptions, AiPoolProvider } from "./ai-pool.options"

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
const DEEPSEEK_FAST_MODEL = "deepseek-chat"
const DEEPSEEK_SMART_MODEL = "deepseek-reasoner"
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const OPENROUTER_MODEL = "deepseek/deepseek-v4.1-flash"
const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b"

/** An entry of `DEEPSEEK_API_KEYS` written like an environment name is a reference; anything else is the key itself. */
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/u

/** The part of the env reader the pool reads through, so a `<KEY>_FILE` mount supplies a key like a plain variable. */
export interface AiPoolEnv {
    /** True when the key is declared and not empty. */
    has(key: string): boolean
    /** The declared value of an optional key, or undefined. */
    optional(key: string): string | undefined
    /** A required secret; stops boot naming the key when it is not declared. */
    secret(key: string): Secret
}

/** The base URL a key declares, without trailing slashes; the public default when it is absent or not an http(s) URL. */
const baseUrlOf = (env: AiPoolEnv, key: string, fallback: string): string => {
    const declared = env.optional(key)
    if (declared === undefined) return fallback
    if (!URL.canParse(declared) || !/^https?:$/u.test(new URL(declared).protocol)) return fallback
    let end = declared.length
    while (end > 0 && declared[end - 1] === "/") end -= 1
    return declared.slice(0, end)
}

/** The keys of the named variables that are set, each named by its variable. */
const declaredKeys = (env: AiPoolEnv, names: ReadonlyArray<string>): Array<AiPoolKey> =>
    names.flatMap((name) => (env.has(name) ? [{ alias: name, secret: env.secret(name) }] : []))

/**
 * The keys `DEEPSEEK_API_KEYS` lists, comma-separated: an environment name is read through the env reader (a `<NAME>_FILE` mount
 * included) and stops boot naming it when unset; any other entry is a key value, named `deepseek-<place>`.
 */
const listedKeys = (env: AiPoolEnv): Array<AiPoolKey> =>
    (env.optional("DEEPSEEK_API_KEYS") ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .flatMap((entry, index) => {
            if (entry === "") return []
            return ENV_NAME.test(entry)
                ? [{ alias: entry, secret: env.secret(entry) }]
                : [{ alias: `deepseek-${index + 1}`, secret: new Secret(entry) }]
        })

/** The keys with the first of each alias kept: a variable named twice is one lane (the router refuses a repeated alias). */
const distinct = (keys: ReadonlyArray<AiPoolKey>): Array<AiPoolKey> =>
    keys.filter((key, index) => keys.findIndex((other) => other.alias === key.alias) === index)

const deepseekOf = (env: AiPoolEnv): AiPoolProvider => ({
    id: "deepseek",
    baseUrl: DEEPSEEK_BASE_URL,
    keys: distinct([...listedKeys(env), ...declaredKeys(env, ["DEEPSEEK_API_KEY"])]),
    model: DEEPSEEK_FAST_MODEL,
    smartModel: DEEPSEEK_SMART_MODEL,
})

const openrouterOf = (env: AiPoolEnv): AiPoolProvider => ({
    id: "openrouter",
    baseUrl: baseUrlOf(env, "LLM_BASE_URL", OPENROUTER_BASE_URL),
    keys: declaredKeys(env, ["LLM_API_KEY", "OPENROUTER_API_KEY"]),
    model: env.optional("LLM_MODEL") ?? OPENROUTER_MODEL,
    smartModel: null,
})

/** The embeddings endpoint keeps its one key: the first declared of its own, OpenRouter's and OpenAI's (DeepSeek embeds nothing). */
const embeddingOf = (env: AiPoolEnv): AiPoolProvider => ({
    id: "embeddings",
    baseUrl: baseUrlOf(env, "EMBEDDING_BASE_URL", OPENROUTER_BASE_URL),
    keys: declaredKeys(env, ["EMBEDDING_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY"]).slice(0, 1),
    model: env.optional("EMBEDDING_MODEL") ?? EMBEDDING_MODEL,
    smartModel: null,
})

/**
 * The AI pool the environment declares. No key is required: without any the pool is empty, the app boots, every call answers nothing
 * and callers fall back (keyword search, template messages, no fact extraction). DeepSeek keys come from `DEEPSEEK_API_KEYS` and
 * `DEEPSEEK_API_KEY`; `LLM_API_KEY` / `OPENROUTER_API_KEY` add the OpenRouter-compatible fallback; `EMBEDDING_*` stays the embeddings
 * endpoint.
 */
export const aiPoolOf = (env: AiPoolEnv): AiPoolOptions => ({
    chat: [deepseekOf(env), openrouterOf(env)],
    embedding: embeddingOf(env),
})
