import type { AiSchema } from "./ai.schema"

/** One message of a chat prompt. */
export interface AiMessage {
    /** Who speaks. */
    readonly role: "system" | "user" | "assistant"
    /** What is said. */
    readonly content: string
}

/** What the endpoint reports about one call; a field is null when it did not say. */
export interface AiUsage {
    /** Tokens of the request. */
    readonly promptTokens: number | null
    /** Tokens of the answer. */
    readonly completionTokens: number | null
    /** Tokens of both. */
    readonly totalTokens: number | null
    /** The cost in US dollars, when the endpoint reports it (OpenRouter and the gateway can). */
    readonly costUsd: number | null
}

/** One retrieved passage of the business notes. */
export interface ContextPassage {
    /** Where it comes from (a document title or a fact label), or null. */
    readonly title: string | null
    /** The text. */
    readonly content: string
}

/** The domain search the retriever wraps: the passages the asking agent may read for a question. */
export type PassageSearch = (question: string) => Promise<ReadonlyArray<ContextPassage>>

/** Retrieval for one chat call: the question searched, how many passages are kept, and the domain search that owns the lanes. */
export interface AiContext {
    /** The question the notes are retrieved for. */
    readonly question: string
    /** The most passages put in the "Business notes" block. */
    readonly limit: number
    /** The domain search; it already applies the lane access of the agent. */
    readonly search: PassageSearch
}

/** One chat call as a chain: prompt, optional retrieved notes, model, and a structured parse when a schema is given. */
export interface AiChatRequest {
    /** The prompt. */
    readonly messages: ReadonlyArray<AiMessage>
    /** True asks the model for one JSON object (`response_format: json_object`). */
    readonly json: boolean
    /** The shape a JSON answer is parsed into by structured output; null parses any JSON object. Ignored for a text answer. */
    readonly schema: AiSchema | null
    /** The whole call in milliseconds. */
    readonly timeoutMs: number
    /** The retrieval step; null when the task needs no business notes. */
    readonly context: AiContext | null
    /** What a reasoning model may spend on the call; absent leaves the model's own defaults. */
    readonly budget?: AiBudget
}

/** The spend a call caps: how hard a reasoning model thinks and how many tokens it may write (reasoning included). */
export interface AiBudget {
    /** The reasoning the endpoint is asked for: none, or an effort. */
    readonly effort: "off" | "low" | "medium" | "high"
    /** The most completion tokens the call may produce, reasoning included. */
    readonly maxTokens: number
}

/** One chat answer. */
export interface AiChatAnswer {
    /** The trimmed text; never empty. */
    readonly text: string
    /** The structured output, or null when no schema was given or the answer did not fit it (the text is then parsed loosely). */
    readonly parsed: Readonly<Record<string, unknown>> | null
    /** The model that answered. */
    readonly model: string
    /** What the endpoint reported. */
    readonly usage: AiUsage
    /** How many passages the retriever put in the prompt. */
    readonly retrieved: number
}

/** One embeddings call. */
export interface AiEmbedRequest {
    /** The texts, in order. */
    readonly input: ReadonlyArray<string>
    /** The vector size asked for. */
    readonly dimensions: number
    /** The whole call in milliseconds. */
    readonly timeoutMs: number
}

/** The vectors of one embeddings call, in the order of the texts; the caller checks the count and the size. */
export interface AiEmbedding {
    /** One vector per text; an entry that is not numbers is empty. */
    readonly vectors: ReadonlyArray<ReadonlyArray<number>>
    /** LangChain does not report embedding usage, so this is always null and callers estimate from the text. */
    readonly usage: AiUsage | null
}

/** A chat answer, or null when AI is unavailable (no key), the call failed or the answer was empty. */
export type AiChatResult = AiChatAnswer | null

/** The vectors, or null when AI is unavailable (no key) or the call failed. */
export type AiEmbeddingResult = AiEmbedding | null

/** What the chain returns before the client reads it: loose values, as LangChain types them. */
export interface ChainReply {
    /** The message content of the model. */
    readonly content: unknown
    /** The structured output, or null. */
    readonly parsed: unknown
    /** The `usage_metadata` of the message. */
    readonly usageMetadata: unknown
    /** The `response_metadata` of the message. */
    readonly responseMetadata: unknown
    /** How many passages the retriever found. */
    readonly retrieved: number
}

/** The two calls the app makes through LangChain; the adapter over `@langchain/*` implements it and a spec stands in for it. */
export interface AiRunner {
    /** Runs the chat chain once and answers its raw reply. */
    chat(request: AiChatRequest): Promise<ChainReply>
    /** Embeds the texts and answers the raw vectors. */
    embed(request: AiEmbedRequest): Promise<unknown>
}

/** The fetch function LangChain sends through; the client builds it over the platform HTTP port. */
export type AiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
