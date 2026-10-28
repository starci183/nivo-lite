import { Injectable } from "@nestjs/common"
import { EMBEDDING_DIMENSIONS } from "@modules/domain/knowledge-chunks"
import { InjectAiPool } from "@modules/integrations/ai-pool"
import type { AiPoolClient } from "@modules/integrations/ai-pool"
import { EMBED_BATCH } from "./knowledge.contracts"
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
}

/** Told after each batch how many texts have their vector. */
export type EmbedProgress = (done: number, total: number) => Promise<void>

@Injectable()
/** Turns passages into vectors in batches, metering every batch against the workspace. */
export class EmbeddingService {
    constructor(
        @InjectAiPool() private readonly pool: AiPoolClient,
        private readonly usage: UsageMeterService,
    ) {}

    /** True when the deployment can embed at all. */
    configured(): boolean {
        return this.pool.embeddingsReady()
    }

    /** The model new vectors are made with. */
    model(): string {
        return this.pool.embeddingModel()
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

    /** One batch: the vectors, and the call metered. */
    private async embedBatch(request: EmbedRequest, batch: ReadonlyArray<string>): Promise<VectorsResult> {
        const result = await this.pool.embed({
            input: batch,
            dimensions: EMBEDDING_DIMENSIONS,
            timeoutMs: request.timeoutMs,
        })
        if (result === null) return null
        if (request.workspaceId === null) return result.vectors
        await this.usage.record({
            workspaceId: request.workspaceId,
            kind: "embedding",
            module: "knowledge",
            model: this.pool.embeddingModel(),
            usage: result.usage,
            promptChars: batch.reduce((sum, text) => sum + text.length, 0),
        })
        return result.vectors
    }
}
