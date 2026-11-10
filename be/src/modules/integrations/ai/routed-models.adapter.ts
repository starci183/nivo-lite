import { createRoutedModels } from "@starci/ai-router/langchain"
import type { RoutedChat as PackageRoutedChat } from "@starci/ai-router/langchain"
import type { AiChatModel, AiFetch, RoutedChat, RoutedModels } from "./ai.contracts"
import type { AiEndpoint } from "./ai.options"

/** The default limit of one call when a `chat` names none, milliseconds (every caller of the app names one). */
const DEFAULT_TIMEOUT_MS = 60_000

type PackageRoutedModels = ReturnType<typeof createRoutedModels>

/**
 * The package's client as this port's: the same object. The package is ESM and the app reads `@langchain/core` through its CommonJS
 * typings, so TypeScript sees two declarations of one `BaseChatModel` class (its protected members do not unify); the runtime class
 * is the one installed copy (`node_modules/@langchain/core`).
 */
const ownOf = (routed: PackageRoutedChat): RoutedChat => ({
    kind: routed.kind,
    name: routed.name,
    model: routed.model as unknown as AiChatModel,
    fallbacks: routed.fallbacks.map(ownOf),
})

/**
 * The router's clients over the gateway of this deployment, as `@starci/ai-router/langchain` (0.7.0) serves them: a name, a profile
 * or a model, is looked up in the gateway's catalog (`GET /v1/models`) and answered with the LangChain client of the protocol its
 * first candidate speaks (`ChatAnthropic` on the gateway's Anthropic Messages route, `ChatOpenAI` on its OpenAI route), under the
 * one virtual key, with the same name through its other protocols as `fallbacks`. No client retries anything (`maxRetries: 0`): the
 * app owns the tries. The network is the platform HTTP port, through `fetcherOf`, bounded by the call's deadline: one router
 * instance per deadline the app uses (a handful: a task, a node's first try, a node's retry), each reading the catalog once.
 */
export const gatewayRoutedModels = (endpoint: AiEndpoint, fetcherOf: (timeoutMs: number) => AiFetch): RoutedModels => {
    const instances = new Map<number, PackageRoutedModels>()
    const within = (timeoutMs: number): PackageRoutedModels => {
        const known = instances.get(timeoutMs)
        if (known !== undefined) return known
        const created = createRoutedModels({
            gatewayUrl: endpoint.gatewayUrl,
            virtualKey: endpoint.virtualKey.reveal(),
            fetch: fetcherOf(timeoutMs),
            timeoutMs,
        })
        instances.set(timeoutMs, created)
        return created
    }
    return {
        chat: async (name, options = {}) => {
            const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
            const routed = await within(timeoutMs).chat(name, {
                timeoutMs,
                ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
                ...(options.fields === undefined ? {} : { fields: options.fields }),
            })
            return ownOf(routed)
        },
        embeddings: (name, timeoutMs = DEFAULT_TIMEOUT_MS) => within(timeoutMs).embeddings(name),
    }
}
