/** What a model provider reports about one call; every field is absent when the provider did not say. */
export interface LlmUsage {
    /** Tokens of the request. */
    readonly promptTokens: number | null
    /** Tokens of the answer. */
    readonly completionTokens: number | null
    /** Tokens of both, when the provider reports only the sum. */
    readonly totalTokens: number | null
    /** The cost in US dollars, when the provider reports it. */
    readonly costUsd: number | null
}

/** The vectors of one embeddings call, in the order of the texts. */
export interface LlmEmbedding {
    /** One vector per text, `LLM_EMBEDDING_DIMENSIONS` numbers each. */
    readonly vectors: ReadonlyArray<ReadonlyArray<number>>
    /** What the provider reported about the call. */
    readonly usage: LlmUsage
}

/** What one chat completion takes: the rules, the question and the time it may take. */
export interface LlmCompletionRequest {
    /** The standing instructions of the call. */
    readonly system: string
    /** The one user message. */
    readonly prompt: string
    /** How long the call may take, in milliseconds. */
    readonly timeoutMs: number
}

/** One chat completion. */
export interface LlmCompletion {
    /** The trimmed text of the answer; never empty. */
    readonly text: string
    /** The model that answered. */
    readonly model: string
    /** What the provider reported about the call. */
    readonly usage: LlmUsage
}

/** The dimensions of every stored vector (the pgvector column size); the provider is asked for exactly this many. */
export const LLM_EMBEDDING_DIMENSIONS = 1536

/** What an embeddings call yields: the vectors, or null when nothing could be made (no key, a provider failure, an unexpected answer). */
export type LlmEmbeddingResult = LlmEmbedding | null

/** What a chat completion yields: the answer, or null when none could be made (no key, a provider failure, an empty answer). */
export type LlmCompletionResult = LlmCompletion | null
