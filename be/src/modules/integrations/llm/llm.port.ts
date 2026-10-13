import type { LlmCompletionRequest, LlmCompletionResult, LlmEmbeddingResult } from "./llm.contracts"

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
