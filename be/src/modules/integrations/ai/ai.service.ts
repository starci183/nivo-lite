import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isRecord } from "@modules/platform/primitives"
import type {
    ContextPassage,
    AiChatAttempt,
    AiChatModel,
    AiFailure,
    AiServed,
    AiStopwatch,
    AiTurnRead,
    AiTurnRequest,
    AiChatRequest,
    AiChatResult,
    AiEmbedRequest,
    AiEmbeddingResult,
    PassageSearch,
} from "./ai.contracts"
import { InjectAiOptions, InjectAiRunner } from "./ai.decorators"
import type { OptionalAiRunner } from "./ai.decorators"
import { AiLogEvent } from "./ai.log-events"
import type { AiOptions } from "./ai.options"
import { cutOf, fieldOf, finishOf, laneOf, modelOf, textOf, usageOf, vectorsOf } from "./reply.policy"
import { providerOf } from "./routing.policy"
import { embeddingIdentityOf } from "@nivo-lite/blocks-core"

/** The most characters sent per embedded text; a passage is about 800 characters, this only guards a runaway input. */
const MAX_EMBED_CHARS = 8000

/** The gateway's answers for a profile it does not serve: 403 `model_not_allowed` (the key is not bound to it), 404 `model_not_found`. */
const NOT_SERVED: ReadonlySet<number> = new Set([403, 404])

/** What a failure says, as log fields: its class and status; never its message, which may quote a provider or a prompt. */
const failureOf = (cause: unknown): Readonly<Record<string, unknown>> => ({
    errorClass: isRecord(cause) && typeof cause.name === "string" ? cause.name : "unknown",
    status: fieldOf(cause, "status") ?? null,
})

/** How many characters of the opening system text the short digest covers: the part two different steps of one agent share. */
const OPENING_CHARS = 4000

const digestOf = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 16)

/**
 * What tells the stable part of two prompts apart without logging a prompt: the size and the digest of the system text that opens
 * it, and the digest of its first characters (the agent's craft, which every step of the agent opens with).
 */
const headOf = (messages: AiChatRequest["messages"]): Readonly<Record<string, unknown>> => {
    const [first] = messages
    const head = first?.role === "system" ? first.content : ""
    return {
        messages: messages.length,
        headChars: head.length,
        headDigest: digestOf(head),
        openingDigest: digestOf(head.slice(0, OPENING_CHARS)),
    }
}

/**
 * The upstream that served a call, why the model stopped, and the try's time, from what the endpoint sent back: the upstream an
 * OpenAI-compatible endpoint names in its raw answer (OpenRouter's `provider`), else the pool provider the gateway says served it.
 */
const servedOf = (provider: unknown, responseMetadata: unknown, durationMs: number | null): AiServed => ({
    upstream: typeof provider === "string" && provider !== "" ? provider : laneOf(responseMetadata).provider,
    finishReason: finishOf(responseMetadata),
    durationMs,
})

@Injectable()
/**
 * The one door to the language-model endpoint: LangChain (`@langchain/openai`) pointed at the AI router gateway with a virtual key, or
 * at a provider directly. A call never throws: without a key, or when the call failed, it answers null and callers fall back.
 */
export class AiService implements OnModuleInit {
    /** True once the gateway answered that it does not serve the embeddings profile (see `embeddingsServed`). */
    private embeddingsRefused = false

    constructor(
        @InjectAiOptions() private readonly options: AiOptions,
        @InjectAiRunner() private readonly runner: OptionalAiRunner,
        @InjectLogger() private readonly logger: Logger,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Boot never fails for a missing virtual key: it is logged once and every call answers unavailable. */
    onModuleInit(): void {
        if (this.runner === null && this.options.gatewayUrl !== null && this.options.virtualKey === null) {
            this.logger.warn(AiLogEvent.VirtualKeyMissing, { gatewayUrl: this.options.gatewayUrl })
        }
    }

    /** True when a key is set, so chat and embeddings calls can reach the endpoint. */
    available(): boolean {
        return this.runner !== null
    }

    /** The profile or model chat calls ask for. */
    chatModel(): string {
        return this.options.chatModel
    }

    /**
     * The IDENTITY new vectors are made with, whether or not a key is set: `<model>@<dimensions>` of the configured embeddings profile
     * (blocks-core `models/embeddings.ts`), never the profile name. Every store records it on a vector and compares only rows of it, and
     * the usage of an embeddings call is booked under it (so its price line matches).
     */
    embeddingModel(): string {
        return embeddingIdentityOf(this.options.embeddingModel)
    }

    /**
     * One chat chain at temperature 0: the prompt (with the retrieved business notes when a context is given), the model and, for a
     * JSON task, the structured parse. Null when no key is set, the call failed or the answer is empty or cut. A retrieval that
     * fails leaves the prompt without notes; it never fails the call. A caller that retries reads `attempt` instead, which says why.
     */
    async chat(request: AiChatRequest): Promise<AiChatResult> {
        const tried = await this.attempt(request)
        return tried.ok ? tried.answer : null
    }

    /**
     * One try of a chat call, which never throws: the answer, or the kind of failure it was. An answer cut at the token limit is a
     * failure of its own (`length`), never an answer: what was written is half a text or half a JSON object.
     */
    async attempt(request: AiChatRequest): Promise<AiChatAttempt> {
        if (this.runner === null) return { ok: false, failure: "unconfigured" }
        const elapsed = this.stopwatch()
        try {
            const reply = await this.runner.chat({ ...request, context: this.guarded(request.context) })
            const durationMs = elapsed()
            const text = textOf(reply.content)
            const model = modelOf(reply.responseMetadata, this.options.chatModel)
            if (cutOf(reply.responseMetadata)) {
                this.logger.warn(AiLogEvent.ChatCut, { model, answerChars: text.length })
                return { ok: false, failure: "length" }
            }
            if (text === "") {
                this.logger.warn(AiLogEvent.ChatEmpty, { model })
                return { ok: false, failure: "empty" }
            }
            const usage = usageOf(reply.usageMetadata, reply.responseMetadata)
            const served = servedOf(reply.provider, reply.responseMetadata, durationMs)
            this.logger.info(AiLogEvent.ChatAnswered, {
                model,
                provider: served.upstream,
                finish: served.finishReason,
                ms: durationMs,
                // Named `prompt` and `cached`: the log scrubs any field whose name says "token".
                prompt: usage.promptTokens,
                cached: usage.cachedTokens ?? null,
                // What the model wrote, reasoning included, beside what the caller got: a large gap is thinking nobody reads.
                completion: usage.completionTokens,
                reasoning: usage.reasoningTokens ?? null,
                answerChars: text.length,
                cap: request.budget?.maxTokens ?? null,
                effort: request.budget?.effort ?? null,
                json: request.json,
                // What the call asked of the endpoint's routing (the `provider` object it sent), beside the upstream that served it.
                routing: providerOf(request.routing),
                ...headOf(request.messages),
            })
            return {
                ok: true,
                answer: {
                    text,
                    parsed: isRecord(reply.parsed) ? reply.parsed : null,
                    model,
                    usage,
                    retrieved: reply.retrieved,
                    served,
                },
            }
        } catch (cause) {
            return { ok: false, failure: this.failureOfThrow(cause) }
        }
    }

    /**
     * The chat client of one try of an agent turn, or null when no endpoint is configured. The agent loop makes the call with it;
     * `readTurn` then says what the try came to, and `failureOfThrow` what a call that threw failed as.
     */
    async turnModel(request: AiTurnRequest): Promise<AiChatModel | null> {
        return this.runner === null ? null : this.runner.turnModel(request)
    }

    /**
     * What the message of one try of an agent turn is: an answer with what it used, or the kind of failure. A turn cut at the
     * token limit is `length`; a turn with no text and no tool call is `empty`. An answered turn is logged like every chat answer
     * (the upstream, the prompt and cached sizes, the completion and its hidden reasoning, the tool calls), never its words.
     * `durationMs` is the wall time of the try, when the caller timed it (with `stopwatch`).
     */
    readTurn(message: unknown, request: AiTurnRequest, durationMs?: number): AiTurnRead {
        const responseMetadata = fieldOf(message, "response_metadata")
        const model = modelOf(responseMetadata, this.options.chatModel)
        const text = textOf(fieldOf(message, "content"))
        const calls: unknown = fieldOf(message, "tool_calls")
        const toolCalls = Array.isArray(calls) ? calls.length : 0
        if (cutOf(responseMetadata)) {
            this.logger.warn(AiLogEvent.ChatCut, { model, answerChars: text.length })
            return { ok: false, failure: "length" }
        }
        if (text === "" && toolCalls === 0) {
            this.logger.warn(AiLogEvent.ChatEmpty, { model })
            return { ok: false, failure: "empty" }
        }
        const usage = usageOf(fieldOf(message, "usage_metadata"), responseMetadata)
        const provider: unknown = fieldOf(fieldOf(fieldOf(message, "additional_kwargs"), "__raw_response"), "provider")
        const served = servedOf(provider, responseMetadata, durationMs ?? null)
        this.logger.info(AiLogEvent.ChatAnswered, {
            model,
            provider: served.upstream,
            finish: served.finishReason,
            ms: served.durationMs,
            prompt: usage.promptTokens,
            cached: usage.cachedTokens ?? null,
            completion: usage.completionTokens,
            reasoning: usage.reasoningTokens ?? null,
            answerChars: text.length,
            toolCalls,
            cap: request.budget?.maxTokens ?? null,
            effort: request.budget?.effort ?? null,
            routing: providerOf(request.routing),
            agentTurn: true,
        })
        return { ok: true, model, usage, textChars: text.length, toolCalls, served }
    }

    /**
     * A stopwatch started now: it reads the whole milliseconds since. For a caller that makes the model call itself (the agent
     * loop) and wants its time booked beside its usage; a chat call through `attempt` is timed here.
     */
    stopwatch(): AiStopwatch {
        const started = this.clock.now().getTime()
        return () => Math.max(0, this.clock.now().getTime() - started)
    }

    /** What a model call that threw failed as: the deadline, or the endpoint or provider. Logged by class and status, never by message. */
    failureOfThrow(cause: unknown): AiFailure {
        const failure = failureOf(cause)
        this.logger.warn(AiLogEvent.ChatFailed, failure)
        return failure.errorClass === "TimeoutError" || failure.errorClass === "AbortError" ? "timeout" : "provider"
    }

    /**
     * False once the gateway answered that it does not serve the embeddings profile (403 or 404: the pool holds no `OPENAI_API_KEY`,
     * so `embed-oa` is not declared). Keys change only at a restart, so the answer holds for the life of the process: callers then
     * treat embeddings as not configured (the index job stores passages keyword-only) instead of retrying a call that cannot succeed.
     */
    embeddingsServed(): boolean {
        return !this.embeddingsRefused
    }

    /** Embeds texts in one call: the vectors in the order of the texts; null when no key is set or the call failed (logged). */
    async embed(request: AiEmbedRequest): Promise<AiEmbeddingResult> {
        if (this.runner === null || request.input.length === 0) return null
        try {
            const answer = await this.runner.embed({
                ...request,
                input: request.input.map((text) => text.slice(0, MAX_EMBED_CHARS)),
            })
            return { vectors: vectorsOf(answer), usage: null }
        } catch (cause) {
            const failure = failureOf(cause)
            if (NOT_SERVED.has(Number(failure.status))) this.embeddingsRefused = true
            this.logger.warn(AiLogEvent.EmbeddingFailed, failure)
            return null
        }
    }

    /** The context with a search that cannot fail the call: a failed search finds nothing and is logged. */
    private guarded(context: AiChatRequest["context"]): AiChatRequest["context"] {
        if (context === null) return null
        const search: PassageSearch = async (question): Promise<ReadonlyArray<ContextPassage>> => {
            try {
                return await context.search(question)
            } catch (cause) {
                this.logger.warn(AiLogEvent.RetrievalFailed, failureOf(cause))
                return []
            }
        }
        return { ...context, search }
    }
}
