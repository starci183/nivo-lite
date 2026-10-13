import { Injectable } from "@nestjs/common"
import { toVector } from "@modules/domain/knowledge-chunks"
import { NivoKnowledgeService } from "@modules/domain/nivo-knowledge"
import type { NivoItemInput } from "@modules/domain/nivo-knowledge"
import { EmbeddingService } from "./embedding.service"
import type { NivoSeedResult } from "./knowledge.contracts"

/** How many items are embedded in one call. */
const EMBED_ITEMS = 32

/** The most batches one seed run embeds; the rest waits for the next run. */
const MAX_BATCHES = 50

/** How long one batch of items may take to embed. */
const EMBED_TIMEOUT_MS = 30_000

@Injectable()
/** Publishes the base knowledge of NIVO from its resource files and gives every item a vector of the model in use. */
export class NivoSeedService {
    constructor(
        private readonly nivo: NivoKnowledgeService,
        private readonly embeddings: EmbeddingService,
    ) {}

    /**
     * Makes the table mirror the items: new ones are inserted, changed ones are updated (and lose their vector), items that are no
     * longer given are removed; then every item without a vector of the model in use gets one. The embedding is platform work, not
     * metered against any workspace; without a key the items stay searchable by words only.
     */
    async seed(items: ReadonlyArray<NivoItemInput>): Promise<NivoSeedResult> {
        const written = await this.nivo.upsert(items)
        const removed = await this.nivo.removeExcept(items.map((item) => item.slug))
        const embedded = await this.embedMissing(0, 0)
        return { inserted: written.inserted, updated: written.updated, removed, embedded }
    }

    /** Gives the next batch of items without a vector theirs, then the batch after it, until none is left or the provider fails. */
    private async embedMissing(batch: number, done: number): Promise<number> {
        if (!this.embeddings.configured() || batch >= MAX_BATCHES) return done
        const model = this.embeddings.model()
        const missing = await this.nivo.unembedded(model, EMBED_ITEMS)
        if (missing.length === 0) return done
        const vectors = await this.embeddings.embed({
            workspaceId: null,
            texts: missing.map((item) => item.text),
            timeoutMs: EMBED_TIMEOUT_MS,
        })
        if (vectors === null) return done
        await this.nivo.setVectors({
            model,
            ids: missing.map((item) => item.id),
            vectors: missing.map((_, index) => toVector(vectors[index] ?? [])),
        })
        return this.embedMissing(batch + 1, done + missing.length)
    }
}
