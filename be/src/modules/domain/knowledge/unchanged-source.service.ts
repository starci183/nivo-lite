import { Injectable } from "@nestjs/common"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesService, StoredNote, contentHashOf } from "@modules/domain/knowledge-sources"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import { EmbeddingService } from "./embedding.service"
import type { IndexOutcome } from "./knowledge.contracts"

@Injectable()
/** Tells when a source needs no work at all: its text is the one it already finished, so nothing is cut, embedded, read for facts or reviewed. */
export class UnchangedSourceService {
    constructor(
        private readonly sources: KnowledgeSourcesService,
        private readonly chunks: KnowledgeChunksService,
        private readonly embeddings: EmbeddingService,
    ) {}

    /**
     * Whether this text is the stored text of the source, with its passages and facts complete and every passage holding a vector of the
     * model in use: a text finished before the model changed still needs its vectors, and a text a reindex wrote over a file is not the file.
     */
    holdsWhole(source: SourceRecord, content: string): Promise<boolean> {
        if (source.contentHash !== contentHashOf(content) || content !== source.content.trim()) {
            return Promise.resolve(false)
        }
        const model = this.embeddings.configured() ? this.embeddings.model() : null
        return this.chunks.holds(source.workspaceId, source.id, model)
    }

    /** Nothing changed: no job follows, and the source is ready as it was. */
    async keep(source: SourceRecord): Promise<IndexOutcome> {
        const note = this.embeddings.configured() ? null : StoredNote.KeywordOnly
        await this.sources.keepIndexed(source.workspaceId, source.id, note)
        return "skipped"
    }
}
