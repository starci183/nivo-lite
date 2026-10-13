import { Injectable } from "@nestjs/common"
import { KnowledgeChunksService, chunkText, toVector } from "@modules/domain/knowledge-chunks"
import type { ChunkDraft } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesService, MAX_SOURCE_CHARS, StoredNote } from "@modules/domain/knowledge-sources"
import type { MaybeSource, SourceRecord } from "@modules/domain/knowledge-sources"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { EmbeddingService } from "./embedding.service"
import type { VectorsResult } from "./embedding.service"
import { BULK_CHUNKS } from "./knowledge.contracts"
import type { IndexOutcome, IndexRun } from "./knowledge.contracts"
import { KnowledgeLogEvent } from "./knowledge.log-events"
import { failureOf } from "./source-failure.policy"
import { SourceReaderService } from "./source-reader.service"
import { UsageMeterService } from "./usage-meter.service"

/** The statuses from which a source is not indexed again: it is done, past this stage, or closed. */
const CLOSED: ReadonlyArray<string> = ["ready", "extracting_facts", "failed", "blocked_credits"]

/** How long one embeddings batch may take while a document is indexed. */
const EMBED_TIMEOUT_MS = 20_000

/** The passages to store: each piece with its vector, or without one when there are no vectors. */
const draftsOf = (pieces: ReadonlyArray<string>, vectors: VectorsResult): Array<ChunkDraft> =>
    pieces.map((text, index) => {
        const vector = vectors?.[index]
        return { text, vector: vector === undefined ? null : toVector(vector) }
    })

@Injectable()
/** Reads a document, cuts it into passages, embeds them and stores them, then hands the source on to the reading of its facts. */
export class KnowledgeIndexingService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly sources: KnowledgeSourcesService,
        private readonly chunks: KnowledgeChunksService,
        private readonly reader: SourceReaderService,
        private readonly embeddings: EmbeddingService,
        private readonly usage: UsageMeterService,
    ) {}

    /**
     * Indexes one source: read, chunk, embed, store; then queue the reading of its facts. A source that can never be read is closed
     * as failed with its stored code and the job ends; a failure worth retrying is thrown, for the queue to retry; `failSource` closes
     * the source when the retries run out.
     */
    async index(run: IndexRun): Promise<IndexOutcome> {
        const source = await this.sources.sourceOf(run.workspaceId, run.sourceId)
        if (source === null || CLOSED.includes(source.status)) return "skipped"
        try {
            await this.sources.begin(source.workspaceId, source.id)
            const read = await this.reader.read(source)
            if (read.kind === "refused") return await this.close(source, read.code)
            const content = read.value.text.trim()
            if (content === "") return await this.close(source, StoredNote.Empty)
            if (content.length > MAX_SOURCE_CHARS) return await this.close(source, StoredNote.TooLong)
            const title = read.value.title ?? source.title
            await this.sources.startIndexing(source.workspaceId, source.id, content, title)
            return await this.store({ ...source, content, title })
        } catch (cause) {
            const failure = failureOf(cause)
            if (failure.transient) throw cause
            this.logger.error(KnowledgeLogEvent.SourceFailed, cause, { sourceId: source.id })
            return this.close(source, failure.note)
        }
    }

    /** The job ended as failed (retries used up or an unrecoverable error): the source is closed with the stored code of the cause. */
    async failSource(workspaceId: string, sourceId: string, cause: unknown): Promise<void> {
        this.logger.error(KnowledgeLogEvent.SourceFailed, cause, { sourceId })
        await this.sources.fail(workspaceId, sourceId, failureOf(cause).note)
    }

    /** The source when it waits for its facts to be read, else null (it is gone, done already, or queued again). */
    async sourceForFacts(workspaceId: string, sourceId: string): Promise<MaybeSource> {
        const source = await this.sources.sourceOf(workspaceId, sourceId)
        return source !== null && source.status === "extracting_facts" ? source : null
    }

    /** Closes a source as failed with a stored code. */
    private async close(source: SourceRecord, note: string): Promise<IndexOutcome> {
        await this.sources.fail(source.workspaceId, source.id, note)
        return "failed"
    }

    /**
     * Stores the passages of the source (keeping the vectors of passages that are unchanged), then queues the facts job and moves the
     * source to its facts stage. A large document with no credits left is stored without vectors and waits.
     */
    private async store(source: SourceRecord): Promise<IndexOutcome> {
        const pieces = chunkText(source.content)
        if (pieces.length === 0) return this.close(source, StoredNote.NoPassages)
        if (await this.alreadyEmbedded(source, pieces)) {
            await this.sources.finishIndexing(source.workspaceId, source.id, null, pieces.length)
            return "indexed"
        }
        const noCredits =
            pieces.length > BULK_CHUNKS && (await this.usage.blockedBy(source.workspaceId, "embedding", true))
        const vectors = noCredits
            ? null
            : await this.embeddings.embed(
                  { workspaceId: source.workspaceId, texts: pieces, timeoutMs: EMBED_TIMEOUT_MS },
                  (done, total) => this.sources.advance(source.workspaceId, source.id, 25 + (55 * done) / total),
              )
        await this.chunks.replace({
            workspaceId: source.workspaceId,
            sourceId: source.id,
            module: source.module,
            visibility: source.visibility,
            model: this.embeddings.model(),
            drafts: draftsOf(pieces, vectors),
        })
        if (noCredits) {
            await this.sources.blockIndexing(source.workspaceId, source.id, StoredNote.NoCreditsForIndex, pieces.length)
            return "blocked"
        }
        await this.sources.finishIndexing(
            source.workspaceId,
            source.id,
            vectors === null ? StoredNote.KeywordOnly : null,
            pieces.length,
        )
        return "indexed"
    }

    /** The stored passages are exactly these pieces, all embedded with the model in use. */
    private async alreadyEmbedded(source: SourceRecord, pieces: ReadonlyArray<string>): Promise<boolean> {
        if (!this.embeddings.configured()) return false
        const model = this.embeddings.model()
        const have = await this.chunks.embeddedOf(source.workspaceId, source.id)
        return (
            have.length === pieces.length &&
            have.every((chunk, index) => chunk.order === index && chunk.text === pieces[index] && chunk.model === model)
        )
    }
}
