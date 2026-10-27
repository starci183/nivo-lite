import type {
    LlmCompletionRequest,
    LlmCompletionResult,
    LlmEmbeddingResult,
    LlmPoolChatRequest,
    LlmPoolEmbedRequest,
    LlmPoolEmbeddingResult,
} from "./llm.contracts"

/** The language-model port: every call answers null instead of throwing, so a caller degrades to keyword search or skips the work. */
export interface LlmPort {
    /** True when the deployment holds an embeddings key. */
    embeddingsConfigured(): boolean
    /** The embeddings model new vectors are made with and the only one search compares against. */
    embeddingModel(): string
    /** Embeds at most 32 texts in one call; null when no key is set, the provider fails or it answers an unexpected shape. */
    embed(texts: ReadonlyArray<string>, timeoutMs: number): Promise<LlmEmbeddingResult>
    /** One chat completion; null when no key is set, the provider fails or it answers nothing. */
    complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>
}

/** The AI pool the model port calls through; the app root binds it to the pool client. Every call answers null instead of throwing. */
export interface LlmPool {
    /** True when a chat call can reach a provider. */
    chatReady(): boolean
    /** True when an embeddings call can reach its provider. */
    embeddingsReady(): boolean
    /** The embeddings model, whether or not a key is set. */
    embeddingModel(): string
    /** One chat completion; null when nothing answered. */
    chat(request: LlmPoolChatRequest): Promise<LlmCompletionResult>
    /** One embeddings call; null when nothing answered. */
    embed(request: LlmPoolEmbedRequest): Promise<LlmPoolEmbeddingResult>
}
