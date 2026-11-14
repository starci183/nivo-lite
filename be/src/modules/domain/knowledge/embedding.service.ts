import { Injectable } from "@nestjs/common"
import { EMBEDDING_DIMENSIONS, hasStoredSize } from "@modules/domain/knowledge-chunks"
import { InjectLogger, withWorkStep, type Logger } from "@modules/platform/logging"
import { InjectAi, type AiService } from "@modules/integrations/ai"
import { EMBED_BATCH } from "./knowledge.contracts"
import { KnowledgeLogEvent } from "./knowledge.log-events"
import { UsageMeterService } from "./usage-meter.service"

/** One vector per text, in the order of the texts. */
export type Vectors = ReadonlyArray<ReadonlyArray<number>>

/** The vectors of a call, or null when embeddings are unavailable (no key, a provider failure, no credits). */
export type VectorsResult = Vectors | null

/** What a call to embed texts is told about the work. */
export interface EmbedRequest {
    /** The workspace that pays for the call; null for work done for the platform itself, which is not metered. */
    readonly workspaceId: string | null
    /** The texts, in order. */
    readonly texts: ReadonlyArray<string>
    /** How long one batch may take, in milliseconds. */
    readonly timeoutMs: number
    /**
     * The step the calls are booked as (`step_key`, inside the work in scope): `index` (passages of a document, the default) or
     * `search` (the query of a meaning search).
     */
    readonly step?: EmbedStep | undefined
}

/** The step an embeddings call is booked as. */
export type EmbedStep = "index" | "search"

/** Told after each batch how many texts have their vector. */
export type EmbedProgress = (done: number, total: number) => Promise<void>

@Injectable()
/** Turns passages into vectors in batches, metering every batch against the workspace. */
export class EmbeddingService {
    constructor(
        @InjectAi() private readonly ai: AiService,
        @InjectLogger() private readonly logger: Logger,
        private readonly usage: UsageMeterService,
    ) {}

    /**
     * True when the deployment can embed at all: a key to the gateway, and the gateway has not answered that it does not serve the
     * embeddings profile (no `OPENAI_API_KEY` in its pool). Not configured, the index job stores passages keyword-only.
     */
    configured(): boolean {
        return this.ai.available() && this.ai.embeddingsServed()
    }

    /** The model new vectors are made with. */
    model(): string {
        return this.ai.embeddingModel()
    }

    /** One vector per text, or null when embeddings are unavailable; a batch that fails fails the whole call, nothing partial is kept. */
    embed(request: EmbedRequest, progress?: EmbedProgress): Promise<VectorsResult> {
        return request.texts.length === 0 ? Promise.resolve(null) : this.embedFrom(request, 0, [], progress)
    }

    /** Embeds the batch that starts at `from`, then the next, until the texts are done. */
    private async embedFrom(
        request: EmbedRequest,
        from: number,
        done: Vectors,
        progress: EmbedProgress | undefined,
    ): Promise<VectorsResult> {
        if (from >= request.texts.length) return done
        const embedded = await this.embedBatch(request, request.texts.slice(from, from + EMBED_BATCH))
        if (embedded === null) return null
        const all = [...done, ...embedded]
        if (progress !== undefined) await progress(all.length, request.texts.length)
        return this.embedFrom(request, from + EMBED_BATCH, all, progress)
    }

    /**
     * One batch: the vectors, and the call metered as its step. A workspace's batch is checked against its credit pool BEFORE the call
     * (owner: the pool is the only limit); empty, it answers null like an unavailable model, and the caller keeps passages keyword-only
     * or searches by words until credits return.
     */
    private embedBatch(request: EmbedRequest, batch: ReadonlyArray<string>): Promise<VectorsResult> {
        const step = request.step ?? "index"
        return withWorkStep(step, step === "search" ? "knowledge_search" : "document_read", () =>
            this.embedBatchNow(request, batch),
        )
    }

    private async embedBatchNow(request: EmbedRequest, batch: ReadonlyArray<string>): Promise<VectorsResult> {
        if (request.workspaceId !== null && (await this.usage.blockedBy(request.workspaceId, "embedding", true)))
            return null
        const result = await this.ai.embed({
            input: batch,
            dimensions: EMBEDDING_DIMENSIONS,
            timeoutMs: request.timeoutMs,
        })
        if (result === null) return null
        if (!hasStoredSize(result.vectors, batch.length)) {
            this.logger.warn(KnowledgeLogEvent.EmbeddingUnexpected, {
                expected: batch.length,
                received: result.vectors.length,
            })
            return null
        }
        if (request.workspaceId === null) return result.vectors
        await this.usage.record({
            workspaceId: request.workspaceId,
            kind: "embedding",
            module: "knowledge",
            model: this.ai.embeddingModel(),
            usage: result.usage,
            promptChars: batch.reduce((sum, text) => sum + text.length, 0),
        })
        return result.vectors
    }
}
