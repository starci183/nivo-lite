import type { Secret } from "@modules/platform/config"
import type {
    AiGatewayHost,
    AiGatewayKey,
    AiGatewayMountedKey,
    AiGatewayOptions,
    AiGatewayProvider,
} from "./ai-gateway.options"
import { ANTHROPIC_PROVIDER, modelProfilesOf } from "./ai-gateway-profiles.policy"

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
/** Anthropic's API, which the router's `anthropic` kind speaks the Messages protocol to. */
const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1"
const WORK_MODEL = "deepseek/deepseek-v4.1-flash"
/** The strong model, on Anthropic directly (blocks-core `SONNET_MODEL`). */
const STRONG_MODEL = "claude-sonnet-5-5"
const EMBED_MODEL = "qwen/qwen3-embedding-8b"
const KEYS_PATH = "ai-router-keys.sqlite"
/** The pool of one upstream: `<NAME>` and its numbered siblings `<NAME>_2` … `<NAME>_9`, rotated and failed over by the router. */
const POOL_SIZE = 9

/** The virtual key the gateway mounts: one StarCi key of the api, its label and the fixed profiles it may call (plus every model profile the pool serves). */
const MOUNTED_KEYS: ReadonlyArray<{
    readonly env: string
    readonly label: string
    readonly profiles: ReadonlyArray<string>
}> = [{ env: "STARCI_AI_KEY", label: "nivo", profiles: ["work", "embed"] }]

/** The part of the env reader the pool reads through, so a `<KEY>_FILE` mount supplies a key like a plain variable. */
export interface AiGatewayEnv {
    /** True when the key is declared and not empty. */
    has(key: string): boolean
    /** The declared value of an optional key, or undefined. */
    optional(key: string): string | undefined
    /** A required secret; stops boot naming the key when it is not declared. */
    secret(key: string): Secret
}

/** The base URL a key declares, without trailing slashes; OpenRouter when it is absent or not an http(s) URL. */
const baseUrlOf = (env: AiGatewayEnv, key: string): string => {
    const declared = env.optional(key)
    if (declared === undefined || !URL.canParse(declared) || !/^https?:$/u.test(new URL(declared).protocol)) {
        return OPENROUTER_BASE_URL
    }
    let end = declared.length
    while (end > 0 && declared[end - 1] === "/") end -= 1
    return declared.slice(0, end)
}

/** The key pool of the first declared of the named variables: the variable and its declared numbered siblings, each named by its variable. */
const keysOf = (env: AiGatewayEnv, names: ReadonlyArray<string>): Array<AiGatewayKey> => {
    const name = names.find((candidate) => env.has(candidate))
    if (name === undefined) return []
    const siblings = Array.from({ length: POOL_SIZE - 1 }, (_, index) => `${name}_${String(index + 2)}`)
    return [name, ...siblings.filter((sibling) => env.has(sibling))].map((alias) => ({
        alias,
        secret: env.secret(alias),
    }))
}

/** The mounted keys whose variable is declared, each bound to its fixed profiles and the model profiles; an undeclared one is not mounted. */
const mountedKeysOf = (env: AiGatewayEnv, modelProfiles: ReadonlyArray<string>): Array<AiGatewayMountedKey> =>
    MOUNTED_KEYS.filter((key) => env.has(key.env)).map((key) => ({
        label: key.label,
        secret: env.secret(key.env),
        profiles: [...key.profiles, ...modelProfiles],
    }))

/** The gateway this process hosts; its port is the app port plus one (BE-AI-1), so no port is read here. */
const gatewayOf = (env: AiGatewayEnv, modelProfiles: ReadonlyArray<string>): AiGatewayHost => ({
    keysPath: env.optional("AI_ROUTER_KEYS_PATH") ?? KEYS_PATH,
    mountedKeys: mountedKeysOf(env, modelProfiles),
})

/**
 * The AI gateway the environment declares. No key is required: without an upstream key the pool is empty, no router and no gateway are
 * registered and the app boots with AI unavailable. `OPENROUTER_API_KEY` (or `LLM_API_KEY`) is the upstream key, with `_2` … `_9` siblings for a rotated pool, `LLM_BASE_URL` moves
 * it to another OpenAI-compatible endpoint, `LLM_MODEL` and `EMBEDDING_MODEL` pick the models behind the `work` and `embed` profiles,
 * and `EMBEDDING_BASE_URL` (with `EMBEDDING_API_KEY`) puts embeddings on their own endpoint. `ANTHROPIC_API_KEY` (with `_2` … `_9`)
 * adds Anthropic directly, serving Claude Sonnet 5.5 behind the `sonnet` and Auto profiles; without it those profiles are served by
 * the upstream alone (`sonnet` is then not served at all). Anthropic is pooled only beside an upstream key (the fixed tasks of the
 * app ask `work`, which the upstream serves). The key is read only as a secret reference, never logged.
 */
export const aiGatewayOf = (env: AiGatewayEnv): AiGatewayOptions => {
    const upstream: AiGatewayProvider = {
        id: "upstream",
        baseUrl: baseUrlOf(env, "LLM_BASE_URL"),
        keys: keysOf(env, ["OPENROUTER_API_KEY", "LLM_API_KEY"]),
    }
    const embeddings: AiGatewayProvider = {
        id: "embeddings",
        baseUrl: baseUrlOf(env, "EMBEDDING_BASE_URL"),
        keys: env.has("EMBEDDING_BASE_URL")
            ? keysOf(env, ["EMBEDDING_API_KEY", "OPENROUTER_API_KEY", "LLM_API_KEY"])
            : [],
    }
    const anthropic: AiGatewayProvider = {
        id: ANTHROPIC_PROVIDER,
        kind: "anthropic",
        baseUrl: ANTHROPIC_BASE_URL,
        keys: keysOf(env, ["ANTHROPIC_API_KEY"]),
    }
    // Anthropic joins the pool beside the upstream, never alone: every fixed task of the app asks `work`, which the upstream serves.
    const providers = [upstream, embeddings, ...(upstream.keys.length > 0 ? [anthropic] : [])].filter(
        (provider) => provider.keys.length > 0,
    )
    const models = {
        work: env.optional("LLM_MODEL") ?? WORK_MODEL,
        embed: env.optional("EMBEDDING_MODEL") ?? EMBED_MODEL,
        strong: STRONG_MODEL,
    }
    const modelProfiles = modelProfilesOf(providers, models).map((profile) => profile.name)
    return {
        providers,
        models,
        gateway: providers.length > 0 ? gatewayOf(env, modelProfiles) : null,
    }
}
