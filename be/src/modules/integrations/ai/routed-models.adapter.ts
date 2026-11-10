import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai"
import type { AiFetch, RoutedChat, RoutedChatOptions, RoutedEmbeddings, RoutedModels } from "./ai.contracts"
import type { AiEndpoint } from "./ai.options"

/** The value of `maxTokens` that leaves the cap to the provider (the client leaves `max_tokens` out of the body for it). */
const NO_TOKEN_CAP = -1

/** The default limit of one call when a `chat` names none, milliseconds (every caller of the app names one). */
const DEFAULT_TIMEOUT_MS = 60_000

/**
 * The router's clients over the gateway of this deployment, as `@starci/ai-router` 0.5.0 serves them: every name, a profile or a
 * model, is asked of the gateway's OpenAI-compatible route with the one virtual key, so every client is `ChatOpenAI` (kind `openai`,
 * no fallbacks) and the gateway's adapter speaks to Anthropic. No client retries anything (`maxRetries: 0`): the app owns the tries.
 *
 * 0.7.0 SEAM — at install (`@starci/ai-router` 0.7.0 + `@langchain/anthropic`) this file becomes:
 *     const routed = createRoutedModels({ gatewayUrl: endpoint.gatewayUrl, virtualKey: endpoint.virtualKey.reveal(), fetch: fetcherOf(DEFAULT_TIMEOUT_MS) })
 *     return { chat: (name, options) => routed.chat(name, options), embeddings: (name) => routed.embeddings(name) }
 * and `chatNow` goes (its caller, `AiService.turnModel`, then awaits `chat`). The `openai` fields below stay the caller's (`ai.client.ts`).
 */
export const gatewayRoutedModels = (endpoint: AiEndpoint, fetcherOf: (timeoutMs: number) => AiFetch): RoutedModels => {
    const chatNow = (name: string, options: RoutedChatOptions = {}): RoutedChat => {
        const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
        return {
            kind: "openai",
            name,
            model: new ChatOpenAI({
                model: name,
                apiKey: endpoint.virtualKey.reveal(),
                maxRetries: 0,
                timeout: timeoutMs,
                // The raw answer rides along so the upstream that served the call can be read (the prompt cache is per upstream).
                __includeRawResponse: true,
                maxTokens: options.maxTokens ?? NO_TOKEN_CAP,
                configuration: { baseURL: endpoint.gatewayUrl, fetch: fetcherOf(timeoutMs) },
                // The `openai` kind's own fields (temperature, the upstream's body fields), only for this kind.
                ...options.fields?.openai,
            }),
            fallbacks: [],
        }
    }
    return {
        chatNow,
        chat: (name, options) => Promise.resolve(chatNow(name, options)),
        embeddings: (name, today = {}): Promise<RoutedEmbeddings> => {
            const timeoutMs = today.timeoutMs ?? DEFAULT_TIMEOUT_MS
            return Promise.resolve({
                kind: "openai",
                name,
                embeddings: new OpenAIEmbeddings({
                    model: name,
                    apiKey: endpoint.virtualKey.reveal(),
                    ...(today.dimensions === undefined ? {} : { dimensions: today.dimensions }),
                    maxRetries: 0,
                    timeout: timeoutMs,
                    configuration: { baseURL: endpoint.gatewayUrl, fetch: fetcherOf(timeoutMs) },
                }),
            })
        },
    }
}
