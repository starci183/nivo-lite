import { Injectable } from "@nestjs/common"
import { KnowledgeChunksService, passageHashOf, toVector } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { EmbeddingService } from "./embedding.service"
import { REEMBED_BATCH, REEMBED_MAX_BATCHES } from "./knowledge.contracts"
import type { ReembedOutcome } from "./knowledge.contracts"
import { UsageMeterService } from "./usage-meter.service"

/** How long one batch of passages may take to embed. */
const REEMBED_TIMEOUT_MS = 30_000

@Injectable()
/** Gives the passages of a workspace that were made by another model (or have no vector) a vector of the model in use. */
export class KnowledgeReembedService {
    constructor(
        private readonly sources: KnowledgeSourcesService,
        private readonly chunks: KnowledgeChunksService,
        private readonly embeddings: EmbeddingService,
        private readonly usage: UsageMeterService,
    ) {}

    /** Queues the re-embedding of the workspace's stale passages with the model in use. */
    request(userId: string, workspaceId: string): Promise<void> {
        return this.sources.requestReembed(userId, workspaceId, this.embeddings.model())
    }

    /**
     * Re-embeds up to a bounded number of batches. "more" means the bound was reached and a follow-up job should continue,
     * "blocked" that the workspace has no credits left, "unavailable" that the provider failed (try again later), "mismatch"
     * that the job asked for a model this deployment does not embed with; an empty `model` means the model in use.
     */
    reembed(workspaceId: string, model: string): Promise<ReembedOutcome> {
        if (!this.embeddings.configured()) return Promise.resolve("done")
        const current = this.embeddings.model()
        if (model !== "" && model !== current) return Promise.resolve("mismatch")
        return this.batchFrom(workspaceId, current, 0)
    }

    /** Embeds the batch numbered `batch`, then the next, until none is stale, the credits end, or the bound is reached. */
    private async batchFrom(workspaceId: string, model: string, batch: number): Promise<ReembedOutcome> {
        if (batch >= REEMBED_MAX_BATCHES) return "more"
        if (await this.usage.blockedBy(workspaceId, "embedding", true)) return "blocked"
        const stale = await this.chunks.stale(workspaceId, model, REEMBED_BATCH)
        if (stale.length === 0) return "done"
        const vectors = await this.embeddings.embed({
            workspaceId,
            texts: stale.map((chunk) => chunk.text),
            timeoutMs: REEMBED_TIMEOUT_MS,
        })
        if (vectors === null) return "unavailable"
        await this.chunks.setVectors({
            workspaceId,
            model,
            ids: stale.map((chunk) => chunk.id),
            vectors: stale.map((_, index) => toVector(vectors[index] ?? [])),
            hashes: stale.map((chunk) => passageHashOf(chunk.text, model)),
        })
        return stale.length < REEMBED_BATCH ? "done" : this.batchFrom(workspaceId, model, batch + 1)
    }
}
