import { Injectable } from "@nestjs/common"
import type { VectorEmbedder, VectorsEmbedded } from "@modules/domain/vector-sync"
import { EmbeddingService } from "./embedding.service"
import { UsageMeterService } from "./usage-meter.service"

/** How long one embedding call of the vector sync may take. */
const EMBED_TIMEOUT_MS = 20_000

@Injectable()
/**
 * The embedding door of the vector sync: the same metered `EmbeddingService` every passage and truth is embedded through, behind the
 * credit check (the plan's pool, never a daily quota). An empty pool answers `blocked`: the rows wait and are found by words; a
 * provider failure answers `failed`. Every answered call is booked to the workspace as `embedding`.
 */
export class VectorEmbedderService implements VectorEmbedder {
    constructor(
        private readonly embeddings: EmbeddingService,
        private readonly usage: UsageMeterService,
    ) {}

    /** True when the deployment can embed at all. */
    configured(): boolean {
        return this.embeddings.configured()
    }

    /** The embedding identity new vectors are made with. */
    model(): string {
        return this.embeddings.model()
    }

    /** One vector per text for the workspace that pays, after the credit check. */
    async embed(workspaceId: string, texts: ReadonlyArray<string>): Promise<VectorsEmbedded> {
        if (await this.usage.blockedBy(workspaceId, "embedding", true)) return { kind: "blocked" }
        const vectors = await this.embeddings.embed({ workspaceId, texts, timeoutMs: EMBED_TIMEOUT_MS })
        return vectors === null ? { kind: "failed" } : { kind: "vectors", vectors }
    }
}
