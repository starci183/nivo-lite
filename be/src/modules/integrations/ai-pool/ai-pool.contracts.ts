/** One message of a chat prompt. */
export interface AiPoolMessage {
    /** Who speaks. */
    readonly role: "system" | "user" | "assistant"
    /** What is said. */
    readonly content: string
}

/** What the pool reports about one call; a field is null when the provider did not say. */
export interface AiPoolUsage {
    /** Tokens of the request. */
    readonly promptTokens: number | null
    /** Tokens of the answer. */
    readonly completionTokens: number | null
    /** Tokens of both. */
    readonly totalTokens: number | null
    /** The cost in US dollars, when the provider reports it (OpenRouter does). */
    readonly costUsd: number | null
}

/** One chat call through the pool. */
export interface AiPoolChatRequest {
    /** The prompt. */
    readonly messages: ReadonlyArray<AiPoolMessage>
    /** True asks the provider for one JSON object (`response_format: json_object`). */
    readonly json: boolean
    /** The whole call, every key and fallback included, in milliseconds. */
    readonly timeoutMs: number
}

/** One chat answer. */
export interface AiPoolAnswer {
    /** The trimmed text; never empty. */
    readonly text: string
    /** The model that answered. */
    readonly model: string
    /** What the provider reported. */
    readonly usage: AiPoolUsage
}

/** One embeddings call through the pool. */
export interface AiPoolEmbedRequest {
    /** The texts, in order. */
    readonly input: ReadonlyArray<string>
    /** The vector size asked for. */
    readonly dimensions: number
    /** The whole call in milliseconds. */
    readonly timeoutMs: number
}

/** The vectors of one embeddings call: exactly one vector of the asked size per text, in the order of the texts. */
export interface AiPoolEmbedding {
    /** One vector per answered text. */
    readonly vectors: ReadonlyArray<ReadonlyArray<number>>
    /** What the provider reported. */
    readonly usage: AiPoolUsage
}

/** A chat answer, or null when the pool has no key, every lane failed or the answer was empty. */
export type AiPoolAnswerResult = AiPoolAnswer | null

/** The vectors, or null when the pool has no embeddings key, the call failed or it answered another count or size of vectors. */
export type AiPoolEmbeddingResult = AiPoolEmbedding | null
