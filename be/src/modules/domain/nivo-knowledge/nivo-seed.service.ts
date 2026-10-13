import { Injectable } from "@nestjs/common"
import { toVector } from "@modules/domain/knowledge-chunks"
import { InjectLlm } from "@modules/integrations/llm"
import type { LlmPort } from "@modules/integrations/llm"
import { unwrapOutcome } from "@modules/platform/primitives"
import { NivoKnowledgeError, NivoKnowledgeErrorCode } from "./errors/nivo-knowledge.error"
import { NivoFolderClient } from "./nivo-folder.client"
import { nivoItemOf } from "./nivo-item.policy"
import type { NivoFile } from "./nivo-item.policy"
import { InjectNivoKnowledgeOptions } from "./nivo-knowledge.decorators"
import type { NivoKnowledgeOptions } from "./nivo-knowledge.options"
import { NivoKnowledgeService } from "./nivo-knowledge.service"
import type { MaybeFolder, NivoSeedResult } from "./nivo-knowledge.contracts"

/** How many items are embedded in one call. */
const EMBED_ITEMS = 32

/** The most batches one seed run embeds; the rest waits for the next run. */
const MAX_BATCHES = 50

/** How long one batch of items may take to embed. */
const EMBED_TIMEOUT_MS = 30_000

@Injectable()
/** Publishes the base knowledge of NIVO from its shipped knowledge files and gives every item a vector of the model in use. */
export class NivoSeedService {
    constructor(
        @InjectNivoKnowledgeOptions() private readonly options: NivoKnowledgeOptions,
        @InjectLlm() private readonly llm: LlmPort,
        private readonly nivo: NivoKnowledgeService,
        private readonly folder: NivoFolderClient,
    ) {}

    /** Reads the base knowledge (the shipped one when no folder is named, else that folder on disk) and publishes what it holds. */
    async seedFolder(dir: MaybeFolder): Promise<NivoSeedResult> {
        return this.seedFiles(await this.folder.read(dir))
    }

    /**
     * Makes the table mirror the files: new items are inserted, changed ones are updated (and lose their vector), items that are no
     * longer given are removed; then every item without a vector of the model in use gets one. The embedding is platform work, not
     * metered against any workspace; without a key the items stay searchable by words only. A file that cannot be read, or two files
     * with one slug, refuse the whole run before anything is written.
     */
    private async seedFiles(files: ReadonlyArray<NivoFile>): Promise<NivoSeedResult> {
        const slugs = new Set<string>()
        const items = files.map((file) => {
            const item = unwrapOutcome(nivoItemOf(file, this.options.folders), NivoKnowledgeError)
            if (slugs.has(item.slug)) {
                throw new NivoKnowledgeError({
                    code: NivoKnowledgeErrorCode.SlugDuplicate,
                    params: { file: file.path },
                })
            }
            slugs.add(item.slug)
            return item
        })
        const written = await this.nivo.upsert(items)
        const removed = await this.nivo.removeExcept(items.map((item) => item.slug))
        const embedded = await this.embedMissing(0, 0)
        return { inserted: written.inserted, updated: written.updated, removed, embedded }
    }

    /** Gives the next batch of items without a vector theirs, then the batch after it, until none is left or the provider fails. */
    private async embedMissing(batch: number, done: number): Promise<number> {
        if (!this.llm.embeddingsConfigured() || batch >= MAX_BATCHES) return done
        const model = this.llm.embeddingModel()
        const missing = await this.nivo.unembedded(model, EMBED_ITEMS)
        if (missing.length === 0) return done
        const embedding = await this.llm.embed(
            missing.map((item) => item.text),
            EMBED_TIMEOUT_MS,
        )
        if (embedding === null) return done
        await this.nivo.setVectors({
            model,
            ids: missing.map((item) => item.id),
            vectors: missing.map((_, index) => toVector(embedding.vectors[index] ?? [])),
        })
        return this.embedMissing(batch + 1, done + missing.length)
    }
}
