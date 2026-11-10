import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isRecord } from "@modules/platform/primitives"
import type {
    ContextPassage,
    AiChatAttempt,
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
import { fieldOf, modelOf, textOf, usageOf, vectorsOf } from "./reply.policy"

/** The most characters sent per embedded text; a passage is about 800 characters, this only guards a runaway input. */
const MAX_EMBED_CHARS = 8000

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

@Injectable()
/**
 * The one door to the language-model endpoint: LangChain (`@langchain/openai`) pointed at the AI router gateway with a virtual key, or
 * at a provider directly. A call never throws: without a key, or when the call failed, it answers null and callers fall back.
 */
export class AiService implements OnModuleInit {
    constructor(
        @InjectAiOptions() private readonly options: AiOptions,
        @InjectAiRunner() private readonly runner: OptionalAiRunner,
        @InjectLogger() private readonly logger: Logger,
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

    /** The profile or model new vectors are made with, whether or not a key is set. */
    embeddingModel(): string {
        return this.options.embeddingModel
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
        try {
            const reply = await this.runner.chat({ ...request, context: this.guarded(request.context) })
            const text = textOf(reply.content)
            const model = modelOf(reply.responseMetadata, this.options.chatModel)
            if (fieldOf(reply.responseMetadata, "finish_reason") === "length") {
                this.logger.warn(AiLogEvent.ChatCut, { model, answerChars: text.length })
                return { ok: false, failure: "length" }
            }
            if (text === "") {
                this.logger.warn(AiLogEvent.ChatEmpty, { model })
                return { ok: false, failure: "empty" }
            }
            const usage = usageOf(reply.usageMetadata, reply.responseMetadata)
            this.logger.info(AiLogEvent.ChatAnswered, {
                model,
                provider: typeof reply.provider === "string" ? reply.provider : null,
                // Named `prompt` and `cached`: the log scrubs any field whose name says "token".
                prompt: usage.promptTokens,
                cached: usage.cachedTokens ?? null,
                // What the model wrote, reasoning included, beside what the caller got: a large gap is thinking nobody reads.
                completion: usage.completionTokens,
                answerChars: text.length,
                effort: request.budget?.effort ?? null,
                json: request.json,
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
                },
            }
        } catch (cause) {
            const failure = failureOf(cause)
            this.logger.warn(AiLogEvent.ChatFailed, failure)
            const timedOut = failure.errorClass === "TimeoutError" || failure.errorClass === "AbortError"
            return { ok: false, failure: timedOut ? "timeout" : "provider" }
        }
    }

    /** Embeds texts in one call: the vectors in the order of the texts; null when no key is set or the call failed. */
    async embed(request: AiEmbedRequest): Promise<AiEmbeddingResult> {
        if (this.runner === null || request.input.length === 0) return null
        try {
            const answer = await this.runner.embed({
                ...request,
                input: request.input.map((text) => text.slice(0, MAX_EMBED_CHARS)),
            })
            return { vectors: vectorsOf(answer), usage: null }
        } catch (cause) {
            this.logger.warn(AiLogEvent.EmbeddingFailed, failureOf(cause))
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
