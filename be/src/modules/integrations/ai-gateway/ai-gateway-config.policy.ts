import type { Secret } from "@modules/platform/config"
import type {
    AiGatewayHost,
    AiGatewayKey,
    AiGatewayMountedKey,
    AiGatewayOptions,
    AiGatewayProvider,
} from "./ai-gateway.options"

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const WORK_MODEL = "deepseek/deepseek-v4.1-flash"
const EMBED_MODEL = "qwen/qwen3-embedding-8b"
const KEYS_PATH = "ai-router-keys.sqlite"

/** The virtual keys the gateway mounts: the env variable that holds each one, its label and the profiles it may call. */
const MOUNTED_KEYS: ReadonlyArray<{
    readonly env: string
    readonly label: string
    readonly profiles: ReadonlyArray<string>
}> = [
    { env: "AI_API_KEY", label: "nivo_api", profiles: ["work", "embed"] },
    { env: "OPENCLAW_AI_KEY", label: "nivo_openclaw", profiles: ["work"] },
]

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

/** The first declared of the named variables as a key named by its variable; none when no variable is set. */
const keysOf = (env: AiGatewayEnv, names: ReadonlyArray<string>): Array<AiGatewayKey> => {
    const name = names.find((candidate) => env.has(candidate))
    return name === undefined ? [] : [{ alias: name, secret: env.secret(name) }]
}

/** The mounted keys whose variable is declared; an undeclared one is simply not mounted. */
const mountedKeysOf = (env: AiGatewayEnv): Array<AiGatewayMountedKey> =>
    MOUNTED_KEYS.filter((key) => env.has(key.env)).map((key) => ({
        label: key.label,
        secret: env.secret(key.env),
        profiles: key.profiles,
    }))

/** The gateway this process hosts; its port is the app port plus one (BE-AI-1), so no port is read here. */
const gatewayOf = (env: AiGatewayEnv): AiGatewayHost => ({
    keysPath: env.optional("AI_ROUTER_KEYS_PATH") ?? KEYS_PATH,
    adminToken: env.has("AI_ROUTER_ADMIN_TOKEN") ? env.secret("AI_ROUTER_ADMIN_TOKEN") : null,
    mountedKeys: mountedKeysOf(env),
})

/**
 * The AI gateway the environment declares. No key is required: without an upstream key the pool is empty, no router and no gateway are
 * registered and the app boots with AI unavailable. `OPENROUTER_API_KEY` (or `LLM_API_KEY`) is the upstream key, `LLM_BASE_URL` moves
 * it to another OpenAI-compatible endpoint, `LLM_MODEL` and `EMBEDDING_MODEL` pick the models behind the `work` and `embed` profiles,
 * and `EMBEDDING_BASE_URL` (with `EMBEDDING_API_KEY`) puts embeddings on their own endpoint.
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
    const providers = [upstream, embeddings].filter((provider) => provider.keys.length > 0)
    return {
        providers,
        models: {
            work: env.optional("LLM_MODEL") ?? WORK_MODEL,
            embed: env.optional("EMBEDDING_MODEL") ?? EMBED_MODEL,
        },
        gateway: providers.length > 0 ? gatewayOf(env) : null,
    }
}
