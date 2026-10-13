import type { Secret } from "@modules/platform/config"

/** One OpenAI-compatible endpoint: where it is, which model to ask and the key to ask it with. */
export interface LlmEndpoint {
    /** The key; absent when the deployment has none (the capability then answers nothing and callers fall back). */
    readonly apiKey: Secret | null
    /** The base URL, without a trailing slash. */
    readonly baseUrl: string
    /** The model asked. */
    readonly model: string
}

/** The language-model capability: embeddings for search and chat completions for reading facts out of documents. */
export interface LlmOptions {
    /** The embeddings endpoint. */
    readonly embedding: LlmEndpoint
    /** The chat-completions endpoint. */
    readonly chat: LlmEndpoint
}
