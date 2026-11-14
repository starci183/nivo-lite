import type { Secret } from "@modules/platform/config"
import { CHEAP_MODEL, EMBEDDING_PROFILES, SONNET_MODEL } from "@nivo-lite/agent-sdk/models"
import type {
    AiGatewayHost,
    AiGatewayKey,
    AiGatewayMountedKey,
    AiGatewayOptions,
    AiGatewayProvider,
} from "./ai-gateway.options"
import { ANTHROPIC_PROVIDER, OPENAI_PROVIDER, modelProfilesOf } from "./ai-gateway-profiles.policy"

/** Anthropic's API, which the router's `anthropic` kind speaks the Messages protocol to. */
const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1"
/** OpenAI's API, the router's `openai` kind. */
const OPENAI_BASE_URL = "https://api.openai.com/v1"
const KEYS_PATH = "ai-router-keys.sqlite"
/** The pool of one provider: `<NAME>` and its numbered siblings `<NAME>_2` … `<NAME>_9`, rotated and failed over by the router. */
const POOL_SIZE = 9

/** The virtual key the gateway mounts: one StarCi key of the api and its label; it may call every profile the pool serves. */
const MOUNTED_KEYS: ReadonlyArray<{
    readonly env: string
    readonly label: string
}> = [{ env: "STARCI_AI_KEY", label: "nivo" }]

/** The part of the env reader the pool reads through, so a `<KEY>_FILE` mount supplies a key like a plain variable. */
export interface AiGatewayEnv {
    /** True when the key is declared and not empty. */
    has(key: string): boolean
    /** The declared value of an optional key, or undefined. */
    optional(key: string): string | undefined
    /** A required secret; stops boot naming the key when it is not declared. */
    secret(key: string): Secret
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

/** The mounted keys whose variable is declared, each bound to the profiles the pool serves; an undeclared one is not mounted. */
const mountedKeysOf = (env: AiGatewayEnv, profiles: ReadonlyArray<string>): Array<AiGatewayMountedKey> =>
    MOUNTED_KEYS.filter((key) => env.has(key.env)).map((key) => ({
        label: key.label,
        secret: env.secret(key.env),
        profiles,
    }))

/** The gateway this process hosts; its port is the app port plus one (BE-AI-1), so no port is read here. */
const gatewayOf = (env: AiGatewayEnv, profiles: ReadonlyArray<string>): AiGatewayHost => ({
    keysPath: env.optional("AI_ROUTER_KEYS_PATH") ?? KEYS_PATH,
    mountedKeys: mountedKeysOf(env, profiles),
})

/** The profile of the app's fixed chat tasks. */
const WORK = "work"

/**
 * Every profile the pool declares with these providers, in a stable order: `work` and the model profiles while Anthropic holds a key,
 * the pinned embeddings profiles (`EMBEDDING_PROFILES`, `embed-oa`) while OpenAI holds one. The router mapper declares exactly these.
 */
export const servedProfilesOf = (
    providers: ReadonlyArray<Pick<AiGatewayProvider, "id">>,
    models: Pick<AiGatewayOptions["models"], "work" | "strong">,
): ReadonlyArray<string> => {
    const present = new Set(providers.map((provider) => provider.id))
    const chat = present.has(ANTHROPIC_PROVIDER) ? [WORK] : []
    const embed = present.has(OPENAI_PROVIDER) ? Object.keys(EMBEDDING_PROFILES) : []
    return [...chat, ...embed, ...modelProfilesOf(providers, models).map((profile) => profile.name)]
}

/**
 * The AI gateway the environment declares (owner 2026-11-11: chat on Claude, embeddings on OpenAI, no more OpenRouter). TWO providers:
 * - `ANTHROPIC_API_KEY` (with `_2` … `_9`) serves EVERY chat profile: `work` (the app's fixed tasks), `sonnet`, `haiku`, `auto-light`,
 *   `auto-heavy`, on Claude Sonnet 5.5 and the cheap model (blocks-core `CHEAP_MODEL`, Claude Haiku 5.5). Without it no chat profile is
 *   declared and every chat call fails loudly; nothing switches vendor.
 * - `OPENAI_API_KEY` (with `_2` … `_9`) serves the pinned embeddings profile `embed-oa` (`text-embedding-3-small`, 1536 dimensions).
 *   Without it no embeddings profile is declared: an embeddings call fails at the gateway (the index job then stores passages
 *   keyword-only).
 * `OPENROUTER_API_KEY`, `LLM_*` and `EMBEDDING_*` are no longer read. No key is required: with none the pool is empty, no router and no
 * gateway are registered and the app boots with AI unavailable. Keys are read only as secret references, never logged.
 */
export const aiGatewayOf = (env: AiGatewayEnv): AiGatewayOptions => {
    const anthropic: AiGatewayProvider = {
        id: ANTHROPIC_PROVIDER,
        kind: "anthropic",
        baseUrl: ANTHROPIC_BASE_URL,
        keys: keysOf(env, ["ANTHROPIC_API_KEY"]),
    }
    const openai: AiGatewayProvider = {
        id: OPENAI_PROVIDER,
        kind: "openai",
        baseUrl: OPENAI_BASE_URL,
        keys: keysOf(env, ["OPENAI_API_KEY"]),
    }
    const providers = [anthropic, openai].filter((provider) => provider.keys.length > 0)
    const models = { work: CHEAP_MODEL, strong: SONNET_MODEL }
    const profiles = servedProfilesOf(providers, models)
    return {
        providers,
        models,
        gateway: profiles.length > 0 ? gatewayOf(env, profiles) : null,
    }
}
