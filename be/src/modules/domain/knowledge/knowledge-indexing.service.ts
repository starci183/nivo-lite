import { Injectable } from "@nestjs/common"
import {
    KnowledgeChunksService,
    reusePlanOf,
    type ChunkDraft,
    type LocatedText,
    type MissingPassage,
    type PassagePlace,
    type StoredAt,
} from "@modules/domain/knowledge-chunks"
import {
    BlockedSourcesService,
    KnowledgeSourcesService,
    MAX_SOURCE_CHARS,
    SourcePartsService,
    StoredNote,
    embedPercent,
    partsOf,
    type MaybeSource,
    type SourceRecord,
} from "@modules/domain/knowledge-sources"
import { VectorSyncService } from "@modules/domain/vector-sync"
import { InjectLogger, withWorkScope, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectTimer, type Timer } from "@modules/platform/retry"
import { EmbeddingService } from "./embedding.service"
import { EMBED_BATCH, type IndexOutcome, type IndexRun } from "./knowledge.contracts"
import { KnowledgeLogEvent } from "./knowledge.log-events"
import { InjectKnowledgeFullOptions } from "./knowledge.decorators"
import type { KnowledgeFullOptions } from "./knowledge.options"
import { KnowledgeError, KnowledgeErrorCode } from "./errors/knowledge.error"
import { layoutOf } from "./passage-layout.policy"
import { failureOf } from "./source-failure.policy"
import { SourceReaderService } from "./source-reader.service"
import { UnchangedSourceService } from "./unchanged-source.service"
import { UsageMeterService } from "./usage-meter.service"

/** The statuses from which a source is not indexed again: it is done, past this stage, or closed. */
const CLOSED: ReadonlySet<string> = new Set(["ready", "extracting_facts", "failed", "blocked_credits"])

/** How long one embeddings batch may take while a document is indexed. */
const EMBED_TIMEOUT_MS = 20_000

/** The most credit-blocked documents one upkeep tick looks at; the rest are looked at by the next tick. */
const RESUME_MAX = 50

/** One passage, embedded or not (the provider gave no vector), and the place it sits at in its document. */
const draftOf = (text: string, vector: ReadonlyArray<number> | undefined, place: PassagePlace | null): ChunkDraft => ({
    text,
    embedded: vector !== undefined,
    ...(place === null ? {} : { place }),
})

/** The passages to store without vectors: each piece as keyword-only text. */
const keywordDraftsOf = (pieces: ReadonlyArray<LocatedText>): Array<ChunkDraft> =>
    pieces.map((piece) => draftOf(piece.text, undefined, piece.place))

/** How many passages a document has and the place each sits at, by order. */
interface PassageLayout {
    readonly total: number
    readonly places: ReadonlyArray<PassagePlace | null>
}

@Injectable()
/** Reads a document, cuts it into passages, embeds them and stores them: the document is then ready (searchable), and its truths are worked out of it by a job of their own. */
export class KnowledgeIndexingService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly sources: KnowledgeSourcesService,
        private readonly blocked: BlockedSourcesService,
        private readonly parts: SourcePartsService,
        private readonly chunks: KnowledgeChunksService,
        private readonly reader: SourceReaderService,
        private readonly unchanged: UnchangedSourceService,
        private readonly embeddings: EmbeddingService,
        private readonly usage: UsageMeterService,
        @InjectKnowledgeFullOptions() private readonly options: KnowledgeFullOptions,
        @InjectTimer() private readonly timer: Timer,
        private readonly vectorSync: VectorSyncService,
    ) {}

    /**
     * Indexes one source: read, chunk, embed, store; then queue the reading of its facts. A source that can never be read is closed
     * as failed with its stored code and the job ends; a failure worth retrying is thrown, for the queue to retry; `failSource` closes
     * the source when the retries run out. A text the source already holds whole does no work at all: a note or a file (its stored object
     * never changes) is known unchanged before it is read, a link only after, since the page can change. A text longer than a source may
     * be is cut at line ends: the first part stays in this source, each later part becomes a source of its own. A new source whose text a
     * finished document of the workspace already holds for the same readers is not worked on at all: it is closed as a duplicate, so the
     * same text is never embedded, read for facts or reviewed twice.
     */
    index(run: IndexRun): Promise<IndexOutcome> {
        // Every model call of the reading (transcription, embeddings) is booked to the document (U1: credits per document).
        return withWorkScope({ kind: "document_read", ref: `source:${run.sourceId}` }, () => this.indexed(run))
    }

    /** The work of `index`, inside the document's work scope. */
    private async indexed(run: IndexRun): Promise<IndexOutcome> {
        const source = await this.sources.sourceOf(run.workspaceId, run.sourceId)
        if (source === null || CLOSED.has(source.status)) return "skipped"
        try {
            if (source.kind !== "url" && (await this.unchanged.holdsWhole(source, source.content.trim()))) {
                return await this.unchanged.keep(source)
            }
            await this.sources.begin(source.workspaceId, source.id)
            const read = await this.reader.read(source)
            // A file whose text needs a model call that the empty pool refused is not failed: it waits, and is read again by itself
            // once the pool has credits (`resumeBlocked`); it has no passage yet, so there is nothing to search meanwhile.
            if (read.kind === "refused" && read.code === StoredNote.NoCreditsForTranscription) return await this.park(source, read.code)
            if (read.kind === "refused") return await this.close(source, read.code)
            const content = read.value.text.trim()
            if (content === "") return await this.close(source, StoredNote.Empty)
            if (await this.unchanged.holdsWhole(source, content)) return await this.unchanged.keep(source)
            const [first = content, ...later] = partsOf(content, MAX_SOURCE_CHARS)
            if (await this.unchanged.closeDuplicate(source, { first, later })) return "skipped"
            const named = read.value.title ?? source.title
            const title =
                later.length === 0 ? named : await this.parts.splitLong(source.workspaceId, source.id, named, later)
            await this.sources.startIndexing(source.workspaceId, source.id, first, title)
            // A long text is split into several documents, so the places of the file's stretches no longer line up with any one of them.
            return await this.store(
                { ...source, content: first, title },
                later.length === 0 ? read.value.parts : undefined,
            )
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

    /**
     * The source when its truths can be worked on, else null: its passages are stored (`ready`; `extracting_facts` is what a source
     * indexed by an earlier build still wears). A source that is gone, failed, or being indexed again is left: its next index queues the work.
     */
    async sourceForFacts(workspaceId: string, sourceId: string): Promise<MaybeSource> {
        const source = await this.sources.sourceOf(workspaceId, sourceId)
        return source !== null && (source.status === "ready" || source.status === "extracting_facts") ? source : null
    }

    /** Closes a source as failed with a stored code. */
    private async close(source: SourceRecord, note: string): Promise<IndexOutcome> {
        await this.sources.fail(source.workspaceId, source.id, note)
        return "failed"
    }

    /** The source waits for credits (`blocked_credits`) with the stored code of what it waits for. */
    private async park(source: SourceRecord, note: StoredNote): Promise<IndexOutcome> {
        await this.sources.blockIndexing(source.workspaceId, source.id, note, 0)
        return "blocked"
    }

    /**
     * Stores the passages of the source, stage by stage: a passage already stored with a vector of the model in use is kept wherever it
     * sits in the text, found by hash, and only the others are embedded, and every batch is stored as soon as it has its vectors, so a retry after a failure resumes where the
     * failed one stopped. A provider that fails a batch throws, so the queue retries and the retry resumes. Then the facts job is
     * queued and the source moves to its facts stage. A document of ANY size with no credits left (D-U-4: the pool is the only limit,
     * and it is asked before the first call) keeps the vectors it already paid for, stores only the missing passages without vectors
     * (searchable by words at once) and waits as `blocked_credits`; the upkeep tick queues it again once the pool has credits
     * (`resumeBlocked`). The same holds when the pool runs out between two batches. Running out of credits never fails a document.
     */
    private async store(source: SourceRecord, parts: ReadonlyArray<LocatedText> | undefined): Promise<IndexOutcome> {
        const { located, places } = layoutOf(source.content, parts)
        const pieces = located.map((piece) => piece.text)
        if (pieces.length === 0) return this.close(source, StoredNote.NoPassages)
        const { workspaceId, id } = source
        await this.sources.enterStage(workspaceId, id, { stage: "chunk", done: pieces.length, total: pieces.length })
        if (!this.embeddings.configured()) {
            await this.chunks.replace({ ...this.writeOf(source), drafts: keywordDraftsOf(located) })
            return this.finish(source, StoredNote.KeywordOnly, pieces.length)
        }
        const stored = await this.chunks.embeddedOf(workspaceId, id)
        const { moves, missing } = reusePlanOf(pieces, stored, this.embeddings.model())
        await this.chunks.arrange({ workspaceId, sourceId: id, moves, count: pieces.length })
        if (places.length > 0) await this.chunks.place({ workspaceId, sourceId: id, places })
        const noCredits = missing.length > 0 && (await this.usage.blockedBy(workspaceId, "embedding", true))
        // A document that already had passages is being read again: its embeddings are booked as the re-read.
        const wordOnly = await withWorkScope({ kind: stored.length > 0 ? "document_reread" : "document_read" }, () =>
            this.embedMissing(
                source,
                { total: pieces.length, places: located.map((piece) => piece.place) },
                missing,
                noCredits,
            ),
        )
        if (!wordOnly) return this.finish(source, null, pieces.length)
        await this.sources.blockIndexing(workspaceId, id, StoredNote.NoCreditsForIndex, pieces.length)
        await this.vectorSync.changedSource(workspaceId, id)
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
        await this.vectorSync.changedSource(source.workspaceId, source.id)
        return "indexed"
    }

    /**
     * The vectors of a stored batch are handed to the vector index under the ids their passages were stored with. Postgres first: the
     * rows are committed (word-searchable at once, no vector in the row), then the index takes the vectors and Postgres records
     * `indexed_at`: the passage is found by meaning from then on. An index that does not answer never fails the document: the queued
     * sync brings its passages in step.
     */
    private async handOver(
        source: SourceRecord,
        batch: ReadonlyArray<MissingPassage>,
        vectors: ReadonlyArray<ReadonlyArray<number>> | null,
        stored: ReadonlyArray<StoredAt>,
    ): Promise<void> {
        if (vectors === null) return
        const idAt = new Map(stored.map((one) => [one.order, one.id]))
        const handed = new Map<string, ReadonlyArray<number>>()
        batch.forEach((entry, offset) => {
            const id = idAt.get(entry.order)
            const vector = vectors[offset]
            if (id !== undefined && vector !== undefined) handed.set(id, vector)
        })
        await this.vectorSync.accept("passage", source.workspaceId, handed)
    }

    /**
     * Embeds the passages that have no vector of the model in use, one batch at a time, and stores each batch at once. With
     * `withoutVectors` (no credits left) it only stores them as keyword passages. A batch that comes back with no vectors is asked
     * about once: the pool ran out since the document started (this batch and the rest are stored as keyword passages), or the
     * provider failed (thrown, so the queue retries and nothing is stored keyword-only by accident). Answers whether passages were
     * stored without vectors for want of credits.
     */
    private async embedMissing(
        source: SourceRecord,
        layout: PassageLayout,
        todo: ReadonlyArray<MissingPassage>,
        withoutVectors: boolean,
    ): Promise<boolean> {
        const { total } = layout
        const size = this.options.indexChunkDelayMs > 0 ? 1 : EMBED_BATCH
        const batches = Array.from({ length: Math.ceil(todo.length / size) }, (_, index) =>
            todo.slice(index * size, index * size + size),
        )
        const state = { done: total - todo.length, wordOnly: withoutVectors }
        await this.sources.enterStage(source.workspaceId, source.id, {
            stage: "embed",
            done: state.done,
            total,
            progress: embedPercent(state.done, total),
        })
        await eachInOrder(batches, async (batch, index) => {
            if (index > 0) await this.pause()
            const vectors = state.wordOnly ? null : await this.embeddings.embed(this.requestOf(source, batch))
            if (vectors === null && !state.wordOnly) {
                if (!(await this.usage.blockedBy(source.workspaceId, "embedding", true)))
                    throw new KnowledgeError({ code: KnowledgeErrorCode.EmbeddingUnavailable })
                state.wordOnly = true
            }
            const stored = await this.chunks.keep({
                ...this.writeOf(source),
                drafts: batch.map((entry, offset) => ({
                    ...draftOf(entry.text, vectors?.[offset], layout.places[entry.order] ?? null),
                    order: entry.order,
                })),
            })
            await this.handOver(source, batch, vectors, stored)
            state.done += batch.length
            await this.sources.advance(source.workspaceId, source.id, {
                stage: "embed",
                done: state.done,
                total,
                progress: embedPercent(state.done, total),
            })
        })
        return state.wordOnly
    }

    /**
     * The upkeep tick: every document that waits for credits with its passages stored word-only (at most `RESUME_MAX`, the
     * longest-waiting first) is queued for indexing again once its workspace's pool allows an embeddings call; the index job then
     * embeds only the passages that have no vector and the document goes on to its truths. One pool read per workspace. Nothing waits
     * for a button (the founder's "retry" stays, and does the same). Never throws. Answers how many were queued.
     */
    async resumeBlocked(): Promise<number> {
        try {
            const waiting = await this.blocked.waiting(RESUME_MAX)
            const open = new Map<string, boolean>()
            const count = { resumed: 0 }
            await eachInOrder(waiting, async (row) => {
                if (!open.has(row.workspaceId))
                    open.set(row.workspaceId, !(await this.usage.blockedBy(row.workspaceId, "embedding", true)))
                if (open.get(row.workspaceId) !== true) return
                if (!(await this.blocked.resume(row.workspaceId, row.id))) return
                this.logger.info(KnowledgeLogEvent.SourceResumed, { sourceId: row.id })
                count.resumed += 1
            })
            return count.resumed
        } catch (cause) {
            this.logger.error(KnowledgeLogEvent.SourceResumeFailed, cause, {})
            return 0
        }
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
