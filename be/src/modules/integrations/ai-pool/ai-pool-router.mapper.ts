import type { AiRouterModuleOptions, KeyConfig, ModelConfig, ProviderConfig } from "@starci/ai-router"
import type { AiPoolKey, AiPoolOptions, AiPoolProvider } from "./ai-pool.options"

/** The router reads each key from the secret parsed at boot, so a `<KEY>_FILE` mount works like a plain variable. */
const keyOf = (key: AiPoolKey): KeyConfig => ({ alias: key.alias, resolve: () => key.secret.reveal() })

/** DeepSeek's chat model answers as "fast", its reasoner as "smart"; the reasoner is never asked for JSON. */
const chatModelsOf = (provider: AiPoolProvider): Array<ModelConfig> => [
    { id: provider.model, ...(provider.id === "deepseek" ? { aliases: ["fast"] } : {}) },
    ...(provider.smartModel === null
        ? []
        : [{ id: provider.smartModel, aliases: ["smart"], capabilities: ["chat", "streaming"] } satisfies ModelConfig]),
]

const providerOf = (provider: AiPoolProvider, models: ReadonlyArray<ModelConfig>): ProviderConfig => ({
    id: provider.id,
    baseUrl: provider.baseUrl,
    headers: { "X-Title": "NIVO OS" },
    keys: provider.keys.map(keyOf),
    models,
})

/** A provider takes part in the pool only when it holds a key. */
export const hasKeys = (provider: AiPoolProvider): boolean => provider.keys.length > 0

/** The chat models in the order a call tries them: the first keyed provider's model, then each fallback, each once. */
export const chatModelOrder = (options: AiPoolOptions): Array<string> =>
    options.chat
        .filter(hasKeys)
        .map((provider) => provider.model)
        .filter((model, index, models) => models.indexOf(model) === index)

/** The ids of the keyed chat providers, so a chat call never lands on the embeddings endpoint. */
export const chatProviderIds = (options: AiPoolOptions): Array<string> =>
    options.chat.filter(hasKeys).map((provider) => provider.id)

/**
 * The router's pool built from the parsed options, or null when no provider holds a key: the router refuses an empty pool, so the
 * app then registers none and the pool answers nothing.
 */
export const routerOptionsOf = (options: AiPoolOptions): AiRouterModuleOptions | null => {
    const chat = options.chat.filter(hasKeys).map((provider) => providerOf(provider, chatModelsOf(provider)))
    const embedding = hasKeys(options.embedding)
        ? [providerOf(options.embedding, [{ id: options.embedding.model, capabilities: ["embeddings"] }])]
        : []
    const providers = [...chat, ...embedding]
    return providers.length === 0 ? null : { providers, telemetry: { includeContent: false } }
}
