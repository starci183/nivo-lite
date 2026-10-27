import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LLM_EMBEDDING_DIMENSIONS } from "./llm.contracts"
import type { LlmCompletionRequest, LlmCompletionResult, LlmEmbeddingResult } from "./llm.contracts"
import { InjectLlmPool } from "./llm.decorators"
import { LlmLogEvent } from "./llm.log-events"
import type { LlmPool, LlmPort } from "./llm.port"

const hasDimensions = (vector: ReadonlyArray<number>): boolean => vector.length === LLM_EMBEDDING_DIMENSIONS

@Injectable()
/**
 * The language-model port over the AI pool: embeddings for search and chat completions for reading facts. The pool picks the key,
 * provider and model and answers null when none could answer; this port keeps its contract (exactly one stored-size vector per text).
 */
export class LlmClient implements LlmPort {
    constructor(
        @InjectLlmPool() private readonly pool: LlmPool,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** True when the deployment holds an embeddings key. */
    embeddingsConfigured(): boolean {
        return this.pool.embeddingsReady()
    }

    /** The embeddings model new vectors are made with and the only one search compares against. */
    embeddingModel(): string {
        return this.pool.embeddingModel()
    }

    /** Embeds at most 32 texts in one call; null when no key is set, the provider fails or it answers an unexpected shape. */
    async embed(texts: ReadonlyArray<string>, timeoutMs: number): Promise<LlmEmbeddingResult> {
        if (texts.length === 0 || !this.pool.embeddingsReady()) return null
        const answer = await this.pool.embed({ input: texts, dimensions: LLM_EMBEDDING_DIMENSIONS, timeoutMs })
        if (answer === null) return null
        if (answer.vectors.length !== texts.length || !answer.vectors.every(hasDimensions)) {
            this.logger.warn(LlmLogEvent.EmbeddingUnexpected, {
                expected: texts.length,
                received: answer.vectors.length,
            })
            return null
        }
        return answer
    }

    /** One chat completion; null when no key is set, the provider fails or it answers nothing. */
    complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
        if (!this.pool.chatReady()) return Promise.resolve(null)
        return this.pool.chat({
            messages: [
                { role: "system", content: request.system },
                { role: "user", content: request.prompt },
            ],
            json: false,
            timeoutMs: request.timeoutMs,
        })
    }
}
