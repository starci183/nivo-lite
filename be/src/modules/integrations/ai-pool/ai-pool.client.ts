import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { AttemptEvent, BreakerEvent, KeyDisabledEvent, RequestEvent } from "@starci/ai-router"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type {
    AiPoolAnswerResult,
    AiPoolChatRequest,
    AiPoolEmbedRequest,
    AiPoolEmbeddingResult,
    AiPoolUsage,
} from "./ai-pool.contracts"
import { InjectAiPoolOptions, InjectAiPoolRouter } from "./ai-pool.decorators"
import type { OptionalAiRouter } from "./ai-pool.decorators"
import { AiPoolLogEvent } from "./ai-pool.log-events"
import type { AiPoolOptions } from "./ai-pool.options"
import { chatModelOrder, chatProviderIds, hasKeys } from "./ai-pool-router.mapper"

/** The most characters sent per embedded text; a passage is about 800 characters, this only guards a runaway input. */
const MAX_EMBED_CHARS = 8000

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** One field of a value that may be an object; undefined for anything else. */
const fieldOf = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined)

const numberOf = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null

const usageOf = (value: unknown): AiPoolUsage => ({
    promptTokens: numberOf(fieldOf(value, "prompt_tokens")),
    completionTokens: numberOf(fieldOf(value, "completion_tokens")),
    totalTokens: numberOf(fieldOf(value, "total_tokens")),
    costUsd: numberOf(fieldOf(value, "cost")),
})

const isNumber = (entry: unknown): entry is number => typeof entry === "number"

/** A vector as numbers; an entry sent in another form (base64) is empty, so the caller's size check refuses it. */
const vectorOf = (value: unknown): ReadonlyArray<number> => {
    const entries = fieldOf(value, "embedding")
    return Array.isArray(entries) && entries.every(isNumber) ? entries : []
}

const indexOf = (value: unknown): number => {
    const index = fieldOf(value, "index")
    return typeof index === "number" ? index : 0
}

/** What a router failure says, as log fields: its class, status and where it went; never its message, which may quote a provider. */
const failureOf = (cause: unknown): Readonly<Record<string, unknown>> => {
    const attempts = fieldOf(cause, "attempts")
    return {
        errorClass: fieldOf(cause, "errorClass") ?? "unknown",
        status: fieldOf(cause, "status") ?? null,
        provider: fieldOf(cause, "provider") ?? null,
        key: fieldOf(cause, "key") ?? null,
        model: fieldOf(cause, "model") ?? null,
        attempts: Array.isArray(attempts) ? attempts.length : 0,
    }
}

@Injectable()
/**
 * The AI pool: the one door to the language-model providers. Every call goes through `@starci/ai-router`, which picks a healthy key,
 * backs off a failing one, honours rate limits, retries on another key or provider and falls back from DeepSeek to OpenRouter. A call
 * never throws: without a key, or when every lane failed, it answers null and callers fall back as they did before the pool.
 */
export class AiPoolClient implements OnModuleInit {
    constructor(
        @InjectAiPoolOptions() private readonly options: AiPoolOptions,
        @InjectAiPoolRouter() private readonly router: OptionalAiRouter,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Sends the router's fallback, breaker, rate-limit and key events to the house logger, by alias only. */
    onModuleInit(): void {
        if (this.router === null) return
        this.router.on("attempt", (event) => this.attempted(event))
        this.router.on("request", (event) => this.settled(event))
        this.router.on("breaker", (event) => this.breaker(event))
        this.router.on("key-disabled", (event) => this.keyDisabled(event))
    }

    /** True when a chat call can reach at least one provider. */
    chatReady(): boolean {
        return this.router !== null && chatModelOrder(this.options).length > 0
    }

    /** True when an embeddings call can reach its provider. */
    embeddingsReady(): boolean {
        return this.router !== null && hasKeys(this.options.embedding)
    }

    /** The embeddings model new vectors are made with, whether or not a key is set. */
    embeddingModel(): string {
        return this.options.embedding.model
    }

    /** One chat completion at temperature 0; null when no key is set, every lane failed or the answer is empty. */
    async chat(request: AiPoolChatRequest): Promise<AiPoolAnswerResult> {
        const models = chatModelOrder(this.options)
        const [preferred, ...fallbacks] = models
        if (this.router === null || preferred === undefined) return null
        try {
            const reply = await this.router.chat(
                {
                    messages: request.messages,
                    temperature: 0,
                    ...(request.json ? { response_format: { type: "json_object" } } : {}),
                },
                {
                    policy: {
                        model: preferred,
                        fallbacks,
                        providers: chatProviderIds(this.options),
                        timeoutMs: request.timeoutMs,
                        deadlineMs: request.timeoutMs,
                    },
                },
            )
            const content = reply.choices[0]?.message.content
            const text = typeof content === "string" ? content.trim() : ""
            if (text === "") {
                this.logger.warn(AiPoolLogEvent.ChatEmpty, {
                    provider: reply.routing.provider,
                    model: reply.routing.model,
                })
                return null
            }
            return { text, model: reply.routing.model, usage: usageOf(reply.usage) }
        } catch (cause) {
            this.logger.warn(AiPoolLogEvent.ChatFailed, failureOf(cause))
            return null
        }
    }

    /** Embeds texts in one call; null when no embeddings key is set or the call failed. */
    async embed(request: AiPoolEmbedRequest): Promise<AiPoolEmbeddingResult> {
        if (this.router === null || !this.embeddingsReady() || request.input.length === 0) return null
        try {
            const answer = await this.router.embeddings(
                {
                    model: this.options.embedding.model,
                    input: request.input.map((text) => text.slice(0, MAX_EMBED_CHARS)),
                    dimensions: request.dimensions,
                },
                {
                    policy: {
                        providers: [this.options.embedding.id],
                        allowFallback: false,
                        timeoutMs: request.timeoutMs,
                        deadlineMs: request.timeoutMs,
                    },
                },
            )
            const data = [...answer.data].sort((a, b) => indexOf(a) - indexOf(b))
            return { vectors: data.map(vectorOf), usage: usageOf(answer.usage) }
        } catch (cause) {
            this.logger.warn(AiPoolLogEvent.EmbeddingFailed, failureOf(cause))
            return null
        }
    }

    private attempted(event: AttemptEvent): void {
        if (event.outcome === "success") return
        const fields = {
            provider: event.provider,
            key: event.key,
            model: event.model,
            errorClass: event.errorClass ?? null,
            status: event.status ?? null,
            attempt: event.attempt,
            latencyMs: event.latencyMs,
        }
        this.logger.warn(
            event.errorClass === "rate_limit" ? AiPoolLogEvent.RateLimited : AiPoolLogEvent.AttemptFailed,
            fields,
        )
    }

    private settled(event: RequestEvent): void {
        if (event.outcome !== "success" || event.attempts <= 1) return
        this.logger.info(AiPoolLogEvent.FellBack, {
            operation: event.operation,
            attempts: event.attempts,
            provider: event.provider ?? null,
            key: event.key ?? null,
            model: event.model ?? null,
        })
    }

    private breaker(event: BreakerEvent): void {
        this.logger.warn(AiPoolLogEvent.BreakerChanged, {
            scope: event.scope,
            provider: event.provider,
            key: event.key ?? null,
            from: event.from,
            to: event.to,
        })
    }

    private keyDisabled(event: KeyDisabledEvent): void {
        this.logger.warn(AiPoolLogEvent.KeyDisabled, {
            provider: event.provider,
            key: event.key,
            reason: event.reason,
            until: event.until,
        })
    }
}
