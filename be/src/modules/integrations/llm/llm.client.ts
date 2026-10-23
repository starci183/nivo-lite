import { Injectable } from "@nestjs/common"
import type { Secret } from "@modules/platform/config"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient, HttpResponse } from "@modules/platform/http"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LLM_EMBEDDING_DIMENSIONS } from "./llm.contracts"
import type { LlmCompletionRequest, LlmCompletionResult, LlmEmbeddingResult, LlmUsage } from "./llm.contracts"
import { InjectLlmOptions } from "./llm.decorators"
import { LlmLogEvent } from "./llm.log-events"
import type { LlmEndpoint, LlmOptions } from "./llm.options"
import type { LlmPort } from "./llm.port"

/** The most characters sent per embedded text; a passage is about 800 characters, this only guards a runaway input. */
const MAX_EMBED_CHARS = 8000

/** The most characters of a provider answer that reach a log line. */
const LOG_BODY_CHARS = 200

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** One field of a value that may be an object; undefined for anything else. */
const fieldOf = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined)

const numberOf = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null

const usageOf = (value: unknown): LlmUsage => ({
    promptTokens: numberOf(fieldOf(value, "prompt_tokens")),
    completionTokens: numberOf(fieldOf(value, "completion_tokens")),
    totalTokens: numberOf(fieldOf(value, "total_tokens")),
    costUsd: numberOf(fieldOf(value, "cost")),
})

const isNumber = (entry: unknown): entry is number => typeof entry === "number"

const vectorOf = (value: unknown): ReadonlyArray<number> | null => {
    const entries = fieldOf(value, "embedding")
    if (!Array.isArray(entries) || entries.length !== LLM_EMBEDDING_DIMENSIONS) return null
    return entries.every(isNumber) ? entries : null
}

const indexOf = (value: unknown): number => {
    const index = fieldOf(value, "index")
    return typeof index === "number" ? index : 0
}

const sortByIndex = (a: unknown, b: unknown): number => indexOf(a) - indexOf(b)

/** Whether a parsed value is a list (`Array.isArray` alone narrows to `any[]`). */
const isList = (value: unknown): value is ReadonlyArray<unknown> => Array.isArray(value)

/** The vectors of an embeddings answer, or null when the answer does not hold exactly `expected` valid vectors. */
const embeddingOf = (body: unknown, expected: number): LlmEmbeddingResult => {
    const data = fieldOf(body, "data")
    const vectors = (isList(data) ? [...data].sort(sortByIndex) : []).map(vectorOf)
    const valid = vectors.flatMap((vector): Array<ReadonlyArray<number>> => (vector === null ? [] : [vector]))
    return valid.length === expected && vectors.length === expected
        ? { vectors: valid, usage: usageOf(fieldOf(body, "usage")) }
        : null
}

/** The first choice of a chat answer as a completion, or null when it holds no text. */
const completionOf = (body: unknown, fallbackModel: string): LlmCompletionResult => {
    const choices = fieldOf(body, "choices")
    const first: unknown = Array.isArray(choices) ? choices[0] : undefined
    const content = fieldOf(fieldOf(first, "message"), "content")
    const text = typeof content === "string" ? content.trim() : ""
    if (text === "") return null
    const model = fieldOf(body, "model")
    return { text, model: typeof model === "string" ? model : fallbackModel, usage: usageOf(fieldOf(body, "usage")) }
}

const shortBody = (response: HttpResponse): string =>
    typeof response.body === "string" ? response.body.slice(0, LOG_BODY_CHARS).replace(/\s+/gu, " ") : ""

@Injectable()
/** The language-model port over two OpenAI-compatible endpoints: embeddings for search and chat completions for reading facts. */
export class LlmClient implements LlmPort {
    constructor(
        @InjectLlmOptions() private readonly options: LlmOptions,
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /**
     * Posts one JSON request and answers the parsed JSON body; undefined when the provider refuses (`refused` is logged with the status and a
     * short body) or the body is not JSON. A network failure or a deadline throws.
     */
    private async post(
        endpoint: LlmEndpoint,
        key: Secret,
        path: string,
        body: object,
        timeoutMs: number,
        refused: LlmLogEvent,
    ): Promise<unknown> {
        const response = await this.http.request({
            method: "POST",
            url: `${endpoint.baseUrl}${path}`,
            headers: { Authorization: `Bearer ${key.reveal()}`, "X-Title": "NIVO OS" },
            body,
            read: "text",
            timeoutMs,
        })
        if (response.status < 200 || response.status >= 300) {
            this.logger.warn(refused, { status: response.status, body: shortBody(response) })
            return undefined
        }
        try {
            return JSON.parse(String(response.body))
        } catch (cause) {
            this.logger.error(LlmLogEvent.BodyUnreadable, cause)
            return undefined
        }
    }

    /** True when the deployment holds an embeddings key. */
    embeddingsConfigured(): boolean {
        return this.options.embedding.apiKey !== null
    }

    /** The embeddings model new vectors are made with and the only one search compares against. */
    embeddingModel(): string {
        return this.options.embedding.model
    }

    /** Embeds at most 32 texts in one call; null when no key is set, the provider fails or it answers an unexpected shape. */
    async embed(texts: ReadonlyArray<string>, timeoutMs: number): Promise<LlmEmbeddingResult> {
        const endpoint = this.options.embedding
        const key = endpoint.apiKey
        if (key === null || texts.length === 0) return null
        try {
            const input = texts.map((text) => text.slice(0, MAX_EMBED_CHARS))
            const body = { model: endpoint.model, input, dimensions: LLM_EMBEDDING_DIMENSIONS }
            const answer = await this.post(endpoint, key, "/embeddings", body, timeoutMs, LlmLogEvent.EmbeddingRefused)
            const embedding = embeddingOf(answer, texts.length)
            if (embedding === null) this.logger.warn(LlmLogEvent.EmbeddingFailed, { reason: "unexpected-shape" })
            return embedding
        } catch (cause) {
            this.logger.error(LlmLogEvent.EmbeddingFailed, cause)
            return null
        }
    }

    /** One chat completion; null when no key is set, the provider fails or it answers nothing. */
    async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
        const endpoint = this.options.chat
        const key = endpoint.apiKey
        if (key === null) return null
        try {
            const messages = [
                { role: "system", content: request.system },
                { role: "user", content: request.prompt },
            ]
            const body = { model: endpoint.model, temperature: 0, messages }
            const answer = await this.post(
                endpoint,
                key,
                "/chat/completions",
                body,
                request.timeoutMs,
                LlmLogEvent.CompletionRefused,
            )
            const completion = completionOf(answer, endpoint.model)
            if (completion === null) this.logger.warn(LlmLogEvent.CompletionFailed, { reason: "empty-answer" })
            return completion
        } catch (cause) {
            this.logger.error(LlmLogEvent.CompletionFailed, cause)
            return null
        }
    }
}
