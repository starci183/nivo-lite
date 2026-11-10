import type { AiRouterModuleOptions, KeyConfig, ModelConfig, ProviderConfig } from "@starci/ai-router"
import type { AiGatewayKey, AiGatewayOptions, AiGatewayProvider } from "./ai-gateway.options"

/** The profile of chat work: the `model` an OpenAI client asks for. */
export const WORK_PROFILE = "work"

/** The profile of embeddings: the `model` an OpenAI client asks for. */
export const EMBED_PROFILE = "embed"

/**
 * How long one attempt of a chat call may take at the gateway, milliseconds. The caller sets the real deadline of each call by its
 * kind (a task, a graph node's call: at most two minutes); the gateway must never cut an attempt before the caller would, or a
 * call the caller still waits for fails as a gateway timeout. So it sits above the longest deadline a caller may set.
 */
export const WORK_ATTEMPT_TIMEOUT_MS = 125_000

/** The whole chat call at the gateway, waits and backoff included: one full attempt, with room to fail over after a quick failure. */
export const WORK_DEADLINE_MS = 130_000

/** US dollars per million tokens of the default models, so the gateway can enforce and account cost quotas. */
const WORK_COST = { input: 0.14, output: 0.42 }
const EMBED_COST = { input: 0.01, output: 0 }

/** The router reads each key from the secret parsed at boot, so a `<KEY>_FILE` mount works like a plain variable. */
const keyOf = (key: AiGatewayKey): KeyConfig => ({ alias: key.alias, resolve: () => key.secret.reveal() })

const providerOf = (provider: AiGatewayProvider, models: ReadonlyArray<ModelConfig>): ProviderConfig => ({
    id: provider.id,
    baseUrl: provider.baseUrl,
    headers: { "X-Title": "NIVO OS" },
    keys: provider.keys.map(keyOf),
    models,
})

/** The pool over a non-empty provider list: the upstream provider serves chat, and embeddings unless they have their own provider. */
const poolOf = (options: AiGatewayOptions): AiRouterModuleOptions => {
    const ownEmbeddings = options.providers.some((provider) => provider.id === "embeddings")
    const chat: ModelConfig = {
        id: options.models.work,
        capabilities: ["chat", "streaming", "tools", "json", "vision"],
        cost: WORK_COST,
    }
    const embed: ModelConfig = { id: options.models.embed, capabilities: ["embeddings"], cost: EMBED_COST }
    const modelsOf = (provider: AiGatewayProvider): Array<ModelConfig> => {
        if (provider.id === "embeddings") return [embed]
        return ownEmbeddings ? [chat] : [chat, embed]
    }
    return {
        providers: options.providers.map((provider) => providerOf(provider, modelsOf(provider))),
        profiles: {
            [WORK_PROFILE]: {
                model: options.models.work,
                providers: ["upstream"],
                // One attempt per call: the caller (the AI task layer) owns the count of tries of a model call, so the gateway
                // never multiplies it by retrying on its own.
                maxAttempts: 1,
                timeoutMs: WORK_ATTEMPT_TIMEOUT_MS,
                deadlineMs: WORK_DEADLINE_MS,
            },
            [EMBED_PROFILE]: {
                model: options.models.embed,
                allowFallback: false,
                providers: [ownEmbeddings ? "embeddings" : "upstream"],
            },
        },
        telemetry: { includeContent: false },
    }
}

/**
 * The router pool built from the parsed options, or null when no provider holds a key: the router refuses an empty pool, so the app
 * then registers neither router nor gateway. A conditional expression, not an `if`, because the contract emitter reads the module
 * graph statically and accepts an option-dependent choice only as an expression whose branches serve the same resolvers.
 */
export const routerOptionsOf = (options: AiGatewayOptions): AiRouterModuleOptions | null =>
    options.providers.length === 0 ? null : poolOf(options)
