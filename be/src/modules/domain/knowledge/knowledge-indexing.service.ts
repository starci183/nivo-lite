import { Injectable } from "@nestjs/common"
import { KnowledgeChunksService, chunkPassages, reusePlanOf, toVector } from "@modules/domain/knowledge-chunks"
import type { ChunkDraft, MissingPassage } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesService, MAX_SOURCE_CHARS, StoredNote, embedPercent } from "@modules/domain/knowledge-sources"
import type { MaybeSource, SourceRecord } from "@modules/domain/knowledge-sources"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectTimer } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { EmbeddingService } from "./embedding.service"
import type { VectorsResult } from "./embedding.service"
import { BULK_CHUNKS, EMBED_BATCH } from "./knowledge.contracts"
import type { IndexOutcome, IndexRun } from "./knowledge.contracts"
import { KnowledgeLogEvent } from "./knowledge.log-events"
import { InjectKnowledgeFullOptions } from "./knowledge.decorators"
import type { KnowledgeFullOptions } from "./knowledge.options"
import { KnowledgeError, KnowledgeErrorCode } from "./errors/knowledge.error"
import { failureOf } from "./source-failure.policy"
import { SourceReaderService } from "./source-reader.service"
import { UnchangedSourceService } from "./unchanged-source.service"
import { UsageMeterService } from "./usage-meter.service"

/** The statuses from which a source is not indexed again: it is done, past this stage, or closed. */
const CLOSED: ReadonlySet<string> = new Set(["ready", "extracting_facts", "failed", "blocked_credits"])

/** How long one embeddings batch may take while a document is indexed. */
const EMBED_TIMEOUT_MS = 20_000

/** One passage with its vector, or without one when the provider gave none. */
const draftOf = (text: string, vector: ReadonlyArray<number> | undefined): ChunkDraft => ({
    text,
    vector: vector === undefined ? null : toVector(vector),
})

/** The passages to store: each piece with its vector, or without one when there are no vectors. */
const draftsOf = (pieces: ReadonlyArray<string>, vectors: VectorsResult): Array<ChunkDraft> =>
    pieces.map((text, index) => draftOf(text, vectors?.[index]))

@Injectable()
/** Reads a document, cuts it into passages, embeds them and stores them, then hands the source on to the reading of its facts. */
export class KnowledgeIndexingService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly sources: KnowledgeSourcesService,
        private readonly chunks: KnowledgeChunksService,
        private readonly reader: SourceReaderService,
        private readonly unchanged: UnchangedSourceService,
        private readonly embeddings: EmbeddingService,
        private readonly usage: UsageMeterService,
        @InjectKnowledgeFullOptions() private readonly options: KnowledgeFullOptions,
        @InjectTimer() private readonly timer: Timer,
    ) {}

    /**
     * Indexes one source: read, chunk, embed, store; then queue the reading of its facts. A source that can never be read is closed
     * as failed with its stored code and the job ends; a failure worth retrying is thrown, for the queue to retry; `failSource` closes
     * the source when the retries run out. A text the source already holds whole does no work at all: a note or a file (its stored object
     * never changes) is known unchanged before it is read, a link only after, since the page can change.
     */
    async index(run: IndexRun): Promise<IndexOutcome> {
        const source = await this.sources.sourceOf(run.workspaceId, run.sourceId)
        if (source === null || CLOSED.has(source.status)) return "skipped"
        try {
            if (source.kind !== "url" && (await this.unchanged.holdsWhole(source, source.content.trim()))) {
                return await this.unchanged.keep(source)
            }
            await this.sources.begin(source.workspaceId, source.id)
            const read = await this.reader.read(source)
            if (read.kind === "refused") return await this.close(source, read.code)
            const content = read.value.text.trim()
            if (content === "") return await this.close(source, StoredNote.Empty)
            if (content.length > MAX_SOURCE_CHARS) return await this.close(source, StoredNote.TooLong)
            if (await this.unchanged.holdsWhole(source, content)) return await this.unchanged.keep(source)
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
     * Stores the passages of the source, stage by stage: a passage already stored with a vector of the model in use is kept wherever it
     * sits in the text, found by hash, and only the others are embedded, and every batch is stored as soon as it has its vectors, so a retry after a failure resumes where the
     * failed one stopped. A provider that fails a batch throws, so the queue retries and the retry resumes. Then the facts job is
     * queued and the source moves to its facts stage. A large document with no credits left keeps the vectors it already paid for,
     * stores only the missing passages without vectors, and waits.
     */
    private async store(source: SourceRecord): Promise<IndexOutcome> {
        const pieces = chunkPassages(source.content)
        if (pieces.length === 0) return this.close(source, StoredNote.NoPassages)
        const { workspaceId, id } = source
        await this.sources.enterStage(workspaceId, id, { stage: "chunk", done: pieces.length, total: pieces.length })
        if (!this.embeddings.configured()) {
            await this.chunks.replace({ ...this.writeOf(source), drafts: draftsOf(pieces, null) })
            return this.finish(source, StoredNote.KeywordOnly, pieces.length)
        }
        const stored = await this.chunks.embeddedOf(workspaceId, id)
        const { moves, missing } = reusePlanOf(pieces, stored, this.embeddings.model())
        await this.chunks.arrange({ workspaceId, sourceId: id, moves, count: pieces.length })
        const noCredits = missing.length > BULK_CHUNKS && (await this.usage.blockedBy(workspaceId, "embedding", true))
        await this.embedMissing(source, pieces.length, missing, noCredits)
        if (!noCredits) return this.finish(source, null, pieces.length)
        await this.sources.blockIndexing(workspaceId, id, StoredNote.NoCreditsForIndex, pieces.length)
        return "blocked"
    }

    /** The stored passages become the passages of the source and it moves on to its facts. */
    private async finish(source: SourceRecord, note: StoredNote | null, count: number): Promise<IndexOutcome> {
        await this.sources.enterStage(source.workspaceId, source.id, {
            stage: "store",
            done: count,
            total: count,
            progress: 80,
        })
        await this.sources.finishIndexing(source.workspaceId, source.id, note, count)
        return "indexed"
    }

    /** Embeds the passages that have no vector of the model in use, one batch at a time, and stores each batch at once. With `withoutVectors` (no credits left) it only stores them as keyword passages. A batch the provider fails throws, so nothing is stored keyword-only by accident. */
    private async embedMissing(
        source: SourceRecord,
        total: number,
        todo: ReadonlyArray<MissingPassage>,
        withoutVectors: boolean,
    ): Promise<void> {
        const size = this.options.indexChunkDelayMs > 0 ? 1 : EMBED_BATCH
        const batches = Array.from({ length: Math.ceil(todo.length / size) }, (_, index) =>
            todo.slice(index * size, index * size + size),
        )
        const state = { done: total - todo.length }
        await this.sources.enterStage(source.workspaceId, source.id, {
            stage: "embed",
            done: state.done,
            total,
            progress: embedPercent(state.done, total),
        })
        await eachInOrder(batches, async (batch, index) => {
            if (index > 0) await this.pause()
            const vectors = withoutVectors ? null : await this.embeddings.embed(this.requestOf(source, batch))
            if (vectors === null && !withoutVectors)
                throw new KnowledgeError({ code: KnowledgeErrorCode.EmbeddingUnavailable })
            await this.chunks.keep({
                ...this.writeOf(source),
                drafts: batch.map((entry, offset) => ({
                    ...draftOf(entry.text, vectors?.[offset]),
                    order: entry.order,
                })),
            })
            state.done += batch.length
            await this.sources.advance(source.workspaceId, source.id, {
                stage: "embed",
                done: state.done,
                total,
                progress: embedPercent(state.done, total),
            })
        })
    }

    /** The demo pause between two passages (`KNOWLEDGE_INDEX_CHUNK_DELAY_MS`); no wait at all when it is 0. */
    private pause(): Promise<void> {
        const ms = this.options.indexChunkDelayMs
        return ms <= 0
            ? Promise.resolve()
            : new Promise((resolve) => {
                  this.timer.schedule(resolve, ms)
              })
    }

    /** The embeddings call of one batch. */
    private requestOf(source: SourceRecord, batch: ReadonlyArray<{ readonly text: string }>) {
        return {
            workspaceId: source.workspaceId,
            texts: batch.map((entry) => entry.text),
            timeoutMs: EMBED_TIMEOUT_MS,
        }
    }

    /** What every write of the passages of a source names besides the passages. */
    private writeOf(source: SourceRecord) {
        return {
            workspaceId: source.workspaceId,
            sourceId: source.id,
            module: source.module,
            visibility: source.visibility,
            installationId: source.installationId,
            model: this.embeddings.model(),
        }
    }
}
