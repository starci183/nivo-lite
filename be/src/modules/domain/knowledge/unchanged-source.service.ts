import { Injectable } from "@nestjs/common"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import {
    KnowledgeSourcesService,
    SourceTwinsService,
    StoredNote,
    contentHashOf,
} from "@modules/domain/knowledge-sources"
import type { SourceRecord, TextParts } from "@modules/domain/knowledge-sources"
import { EmbeddingService } from "./embedding.service"
import type { IndexOutcome } from "./knowledge.contracts"

@Injectable()
/** Tells when a source needs no work at all: its text is the one it already finished, so nothing is cut, embedded, read for facts or reviewed. */
export class UnchangedSourceService {
    constructor(
        private readonly sources: KnowledgeSourcesService,
        private readonly twins: SourceTwinsService,
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

    /**
     * Closes a new source whose text a finished document of the workspace already holds for the same readers: it is ready with the note
     * that says so and holds no passage of its own, so the same text is never embedded, read for facts or reviewed twice. Answers whether
     * it was a duplicate; a source that is not new, or whose text is not held, is left for the work.
     */
    async closeDuplicate(source: SourceRecord, text: TextParts): Promise<boolean> {
        if ((await this.twins.twinOf(source, text)) === null) return false
        await this.sources.ready(source.workspaceId, source.id, StoredNote.Duplicate)
        return true
    }

    /** Nothing changed: no job follows, and the source is ready as it was. */
    async keep(source: SourceRecord): Promise<IndexOutcome> {
        const note = this.embeddings.configured() ? null : StoredNote.KeywordOnly
        await this.sources.keepIndexed(source.workspaceId, source.id, note)
        return "skipped"
    }
}
