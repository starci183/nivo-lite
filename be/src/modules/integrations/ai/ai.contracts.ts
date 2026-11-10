import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import type { AiSchema } from "./ai.schema"

/**
 * The chat client of ONE try of an agent turn, as the agent loop hands it to LangChain: a `ChatOpenAI` of this integration, pointed
 * at the gateway, carrying that try's deadline and limits. Outside `integrations` it is passed along and never called.
 */
export type AiChatModel = BaseChatModel

/** What the client of one try of an agent turn carries: its deadline, what a reasoning model may spend, whose calls these are. */
export interface AiTurnRequest {
    /** The whole try in milliseconds. */
    readonly timeoutMs: number
    /** What a reasoning model may spend on the try; absent leaves the model's own defaults. */
    readonly budget?: AiBudget
    /** Whose calls these are, for cache affinity (see `AiChatRequest.affinity`). */
    readonly affinity?: string
    /** Which upstreams may serve the try (see `AiRouting`); absent sends nothing. */
    readonly routing?: AiRouting
}

/**
 * Which upstreams of the endpoint may serve a call, and in what order: OpenRouter's `provider` object. One model is served by many
 * upstreams whose speed differs several times over and whose prompt caches are separate, so a call that must be predictable names
 * the ones it wants. Every field is optional and an absent routing sends nothing: the endpoint then routes the call as it likes.
 */
export interface AiRouting {
    /**
     * The upstreams to try, first to last (`provider.order`; slugs as the endpoint names them, e.g. `wafer`, `together`). The first
     * one that is up serves the call, so the same upstream sees every call and its prompt cache stays warm without a routing key.
     */
    readonly order?: ReadonlyArray<string>
    /** The only upstreams allowed (`provider.only`); the endpoint picks among them as it does by default. */
    readonly only?: ReadonlyArray<string>
    /** What the endpoint ranks the upstreams by in place of its default balance (`provider.sort`). */
    readonly sort?: "price" | "throughput" | "latency"
    /** False refuses any upstream outside `order` / `only` (`provider.allow_fallbacks`); absent leaves the endpoint's default (true). */
    readonly allowFallbacks?: boolean
}

/** What one try of an agent turn came to, read from the message the model call answered: what it used, or why it is no answer. */
export type AiTurnRead =
    | {
          readonly ok: true
          /** The model that answered. */
          readonly model: string
          /** What the endpoint reported. */
          readonly usage: AiUsage
          /** The characters of text the turn wrote (the arguments of a tool call are not text). */
          readonly textChars: number
          /** How many tool calls the turn made. */
          readonly toolCalls: number
          /** Which upstream served it and why the model stopped. */
          readonly served?: AiServed | undefined
      }
    | { readonly ok: false; readonly failure: AiFailure }

/**
 * The model side of one run of an agent loop, as the loop is handed it. The loop asks for one agent turn at a time and gets the
 * message of the try that succeeded: the tries, their deadlines, the pauses and the metering are all behind `turn`.
 */
export interface AiAgentTurns {
    /** The tool choice of every request of this step: `required` only for a step whose reasoning is off, else `auto`. */
    readonly toolChoice: "auto" | "required"
    /**
     * Runs ONE agent turn under the tries policy. `attempt` makes the model call with the client of that try and resolves to the
     * message it answered (or throws what the call threw). `turn` resolves with the message of the first try that is an answer, and
     * throws once every try failed (`AI_TASKS_UNAVAILABLE` with the tries made and the failure of each).
     */
    turn<M>(attempt: (model: AiChatModel, tryNumber: number) => Promise<M>): Promise<M>
    /**
     * A client to BUILD the agent over, for a library that refuses to construct one without a model: the client a first try of
     * this step would get (its deadline, reasoning, affinity and upstream routing). It is never to be asked: every model call goes
     * through `turn`, which is what counts the tries, sets each try's deadline and meters the answer. Absent when no AI endpoint
     * is configured; `turn` then rejects as unavailable before any call.
     */
    readonly model?: AiChatModel | undefined
}

/** One message of a chat prompt. */
export interface AiMessage {
    /** Who speaks. */
    readonly role: "system" | "user" | "assistant"
    /** What is said. */
    readonly content: string
    /** The pictures said with it, as data addresses. */
    readonly images?: ReadonlyArray<string>
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
    /**
     * How many of the answer's tokens were the model's hidden reasoning (they are part of `completionTokens`, and billed); absent
     * or null when the endpoint did not say. The gap between this and the answer's own size is thinking nobody reads.
     */
    readonly reasoningTokens?: number | null
    /**
     * How many of the request's tokens the provider served from its prompt cache (they are part of `promptTokens`); absent or null
     * when the endpoint did not say. It is only measured: the provider caches the stable prefix of a prompt by itself.
     */
    readonly cachedTokens?: number | null
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
    /**
     * Whose calls these are, for cache affinity (a workspace id): calls that name the same owner are sent with the same routing key
     * (`session_id`), so the endpoint serves them from the same upstream and they find the prompt cache the earlier ones wrote. A
     * provider's cache is per upstream; without the key each new first message is routed afresh and misses it. Only a digest of
     * the name leaves the app. Absent: the endpoint routes the call as it likes.
     */
    readonly affinity?: string
    /** Which upstreams may serve the call (see `AiRouting`); absent sends nothing. */
    readonly routing?: AiRouting
}

/** The spend a call caps: how hard a reasoning model thinks and how many tokens it may write (reasoning included). */
export interface AiBudget {
    /** The reasoning the endpoint is asked for: none, or an effort (`minimal` is the least a model that must reason can be asked for). */
    readonly effort: "off" | "minimal" | "low" | "medium" | "high"
    /**
     * The most tokens the model may spend on reasoning, as a direct cap (`reasoning.max_tokens`), for a model that takes one. An
     * effort is only a share of the output limit, so with no output limit sent it bounds nothing; this is a number. When it is
     * given it is sent in place of the effort (the endpoint takes one or the other). Ignored when the effort is `off`.
     */
    readonly reasoningMaxTokens?: number
    /** The most completion tokens the call may produce, reasoning included; absent leaves the cap to the provider. */
    readonly maxTokens?: number
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
    /** Which upstream served it, why the model stopped and how long the try took. */
    readonly served?: AiServed | undefined
}

/**
 * How one answered call went, beside what it used: what the run page shows per call kind next to the tokens. Each field is null when
 * the endpoint did not say (or, for the time, when the call was not timed here).
 */
export interface AiServed {
    /** The upstream of the endpoint that served the call (OpenRouter's `provider`, e.g. `Wafer`); its prompt cache is its own. */
    readonly upstream: string | null
    /** Why the model stopped (`stop`, `tool_calls`); an answer cut at the limit is never an answer, so never `length` here. */
    readonly finishReason: string | null
    /** The wall time of the try, milliseconds. */
    readonly durationMs: number | null
}

/** Reads the time since it was started, in whole milliseconds: one per try, started right before the model call. */
export type AiStopwatch = () => number

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

/**
 * Why a chat call gave no answer, as the AI's own failure: the deadline passed (`timeout`), the answer was cut at the token limit
 * (`length`), the model answered nothing (`empty`), the endpoint or the provider failed (`provider`), or no endpoint is
 * configured (`unconfigured`).
 */
export type AiFailure = "timeout" | "length" | "empty" | "provider" | "unconfigured"

/** One try of a chat call: its answer, or why there is none. */
export type AiChatAttempt =
    | { readonly ok: true; readonly answer: AiChatAnswer }
    | { readonly ok: false; readonly failure: AiFailure }

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
    /** The upstream that served the call, as the endpoint names it in its raw answer (OpenRouter's `provider`); absent when it does not say. */
    readonly provider?: unknown
}

/** The two calls the app makes through LangChain; the adapter over `@langchain/*` implements it and a spec stands in for it. */
export interface AiRunner {
    /** The chat client of one try of an agent turn: no retry of its own, the try's deadline, its reasoning and its output limit. */
    turnModel(request: AiTurnRequest): AiChatModel
    /** Runs the chat chain once and answers its raw reply. */
    chat(request: AiChatRequest): Promise<ChainReply>
    /** Embeds the texts and answers the raw vectors. */
    embed(request: AiEmbedRequest): Promise<unknown>
}

/** The fetch function LangChain sends through; the client builds it over the platform HTTP port. */
export type AiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
