import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import {
    InjectVectorIndex,
    type VectorIndex,
    type VectorKind,
    type VectorPoint,
    type VectorRow,
    type VectorRowSource,
    type VectorStamp,
} from "@modules/integrations/qdrant"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { VECTOR_SYNC_IDS_MAX, VectorSyncQueue, isVectorSyncPayload } from "@modules/queues/vector-sync"
import {
    NOTHING_SYNCED,
    type VectorEmbedder,
    type VectorSyncDone,
    type VectorSyncMeans,
} from "./vector-sync.contracts"
import { InjectVectorEmbedder, InjectVectorRowSources, type VectorRowSources } from "./vector-sync.decorators"
import { VectorSyncLogEvent } from "./vector-sync.log-events"
import {
    SYNC_EMBED_BATCH,
    RECONCILE_PAGE,
    SYNC_EMBED_CALLS,
    addDone,
    batchesOf,
    byFlags,
    byWorkspace,
    noneDone,
    orphansOf,
    payloadOfRow,
    planOf,
} from "./vector-sync.policy"

/** Where the vector of a row that needs one came from. */
type VectorOrigin = "given" | "copied" | "adopted" | "embedded"

/** The vectors found for the rows that need one, and the rows left without. */
interface VectorsFound {
    /** The vector of each row that got one, with where it came from. */
    readonly vectors: ReadonlyMap<string, { readonly vector: ReadonlyArray<number>; readonly origin: VectorOrigin }>
    /** Rows left without for no fault: no credits, embeddings not configured, or the embedding budget of this sync is spent. */
    readonly waiting: number
    /** Rows whose embedding call failed. */
    readonly failed: number
    /** How many embedding calls were made. */
    readonly calls: number
}

@Injectable()
/**
 * Keeps the vector index in step with Postgres, ONE WAY: Postgres is the system of record, a point is the projection of one row (the
 * point id is the row id), and nothing is ever read back from the index into a row except "the index accepted it" (`indexed_at`).
 *
 * A change reaches the index in two moves, in this order. First the writer commits its rows together with a `vector.sync` job naming
 * them (`VectorSyncQueue.enqueueSync`, or `accept` here when the writer holds fresh vectors). Then the index follows: the job (and
 * `accept`, right after its commit, with the vectors in hand) reads the rows again, compares them with the points the index holds
 * (`planOf`: row id + text hash + model + flags) and writes only the difference. So a replayed job, a job that arrives after the
 * fast path, and the reconcile that walks every row all converge on the same points and write nothing twice.
 *
 * A row that needs a vector gets it, in this order: from the caller (the embedding it just paid for), from Postgres while the
 * pgvector column still exists (the transition), from the point of another row of the same text (adoption: one index read, no
 * embedding call, nothing booked), and only then from an embedding call, credit-checked and booked to the workspace. A row that stays
 * without (no credits, embeddings not configured) waits and is found by words meanwhile.
 */
export class VectorSyncService {
    constructor(
        @Optional() @InjectVectorIndex() private readonly index: VectorIndex | null,
        @InjectVectorRowSources() private readonly sources: VectorRowSources,
        @InjectVectorEmbedder() private readonly embedder: VectorEmbedder,
        private readonly queue: VectorSyncQueue,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** True when the deployment has a vector index: vectors live there, not in Postgres. The one switch every writer and reader asks. */
    bound(): boolean {
        return this.index != null
    }

    /**
     * The `vector.sync` job: brings the points of the rows a change named in step with the rows. A payload of another shape is logged
     * and dropped; a deployment with no index does nothing. A failure of the index throws, so the queue tries the job again.
     */
    async sync(payload: unknown): Promise<VectorSyncDone> {
        if (!isVectorSyncPayload(payload)) {
            this.logger.warn(VectorSyncLogEvent.PayloadRefused, {})
            return NOTHING_SYNCED
        }
        if (this.index == null) return NOTHING_SYNCED
        const done =
            payload.sourceId === undefined
                ? await this.syncRows(this.index, payload.kind, payload.workspaceId, payload.ids ?? [], { embedCalls: SYNC_EMBED_CALLS })
                : await this.syncSource(this.index, payload.workspaceId, payload.sourceId)
        this.logger.info(VectorSyncLogEvent.Synced, { kind: payload.kind, workspaceId: payload.workspaceId, ...done })
        return done
    }

    /**
     * Rows of one workspace changed (a truth put in force, superseded, retired, expired, switched to another reach; passages whose
     * flags changed): their `vector.sync` job is written, in the caller's transaction when it hands one over (the job then exists
     * exactly when the change does), else in one of its own right after the caller's commit. Nothing when the deployment has no index.
     */
    async changed(kind: VectorKind, workspaceId: string, ids: ReadonlyArray<string>, tx?: EntityManager): Promise<void> {
        const unique = [...new Set(ids)]
        if (this.index == null || unique.length === 0) return
        const at = this.clock.now().getTime()
        const write = async (manager: EntityManager): Promise<void> => {
            await eachInOrder(batchesOf(unique, VECTOR_SYNC_IDS_MAX), (batch) =>
                this.queue.enqueueSync({ kind, workspaceId, ids: batch, at }, manager),
            )
        }
        await (tx === undefined ? this.entityManager.transaction(write) : write(tx))
    }

    /**
     * One document changed (indexed, read again, replaced, deleted, its readers or its release to customers changed): the job that
     * brings every passage of it, and every point the index still holds for it, in step. In the caller's transaction when it hands
     * one over. Nothing when the deployment has no index.
     */
    async changedSource(workspaceId: string, sourceId: string, tx?: EntityManager): Promise<void> {
        if (this.index == null) return
        const payload = { kind: "passage" as const, workspaceId, sourceId, at: this.clock.now().getTime() }
        await (tx === undefined
            ? this.entityManager.transaction((manager) => this.queue.enqueueSync(payload, manager))
            : this.queue.enqueueSync(payload, tx))
    }

    /**
     * A writer hands over the vectors it just made for rows it has already committed: the `vector.sync` job of those rows is written
     * first (its own transaction: the durable promise), then the points are written with the vectors in hand and Postgres records
     * that the index accepted them. When the index does not answer, nothing is lost but the vectors: the job brings the rows in step
     * later (adopting or embedding again). Never throws for the index: the writer's work stands.
     */
    async accept(
        kind: VectorKind,
        workspaceId: string,
        vectors: ReadonlyMap<string, ReadonlyArray<number>>,
    ): Promise<VectorSyncDone> {
        const ids = [...vectors.keys()]
        if (this.index == null || ids.length === 0) return NOTHING_SYNCED
        await this.changed(kind, workspaceId, ids)
        try {
            return await this.syncRows(this.index, kind, workspaceId, ids, { given: vectors, embedCalls: 0 })
        } catch (cause) {
            this.logger.error(VectorSyncLogEvent.AcceptFailed, cause, { kind, workspaceId, rows: ids.length })
            return { ...NOTHING_SYNCED, failed: ids.length }
        }
    }

    /**
     * Gives the rows among these that have no current point the vector of another row's point of the same text (or the one Postgres
     * still holds), with NO embedding call: answers the ids that now have a current point. The others still need an embedding.
     * Never throws: when the index does not answer, nothing is adopted.
     */
    async adopt(kind: VectorKind, workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlySet<string>> {
        if (this.index == null || ids.length === 0) return new Set()
        try {
            const index = this.index
            const rows = await this.sources[kind].byIds(workspaceId, ids)
            const stamps = await index.stampsOf(
                kind,
                rows.map((row) => row.id),
            )
            return (await this.settleRows(index, kind, rows, stamps, { embedCalls: 0 })).current
        } catch (cause) {
            this.logger.error(VectorSyncLogEvent.AdoptFailed, cause, { kind, workspaceId, rows: ids.length })
            return new Set()
        }
    }

    /**
     * Brings these rows of one workspace in step with their points; an id with no row any more loses its point. Used by the job, by
     * `accept`, and by nothing that holds a request open.
     */
    private async syncRows(
        index: VectorIndex,
        kind: VectorKind,
        workspaceId: string,
        ids: ReadonlyArray<string>,
        means: VectorSyncMeans,
    ): Promise<VectorSyncDone> {
        const unique = [...new Set(ids)]
        const rows = await this.sources[kind].byIds(workspaceId, unique)
        const stamps = await index.stampsOf(kind, unique)
        const settled = await this.settle(index, kind, rows, stamps, means)
        const known = new Set(rows.map((row) => row.id))
        const gone = stamps.filter((stamp) => !known.has(stamp.id) && stamp.payload.workspaceId === workspaceId).map((stamp) => stamp.id)
        if (gone.length > 0) await index.remove(kind, workspaceId, gone)
        return addDone(settled, { removed: gone.length })
    }

    /**
     * Brings one document's passages in step with its points, both ways: every row of the document is settled, and every point the
     * index still holds for the document whose row is gone is removed (a deleted document has no rows: all its points go).
     */
    private async syncSource(index: VectorIndex, workspaceId: string, sourceId: string): Promise<VectorSyncDone> {
        const rows = await this.sources.passage.ofSource(workspaceId, sourceId)
        const held = await this.stampsOfSource(index, workspaceId, sourceId)
        const settled = await this.settle(index, "passage", rows, held, { embedCalls: SYNC_EMBED_CALLS })
        const orphans = orphansOf(held, new Set(rows.map((row) => row.id))).get(workspaceId) ?? []
        if (orphans.length > 0) await index.remove("passage", workspaceId, orphans)
        return addDone(settled, { removed: orphans.length })
    }

    /** Every point the index holds for one document, page by page. */
    private async stampsOfSource(
        index: VectorIndex,
        workspaceId: string,
        sourceId: string,
        after: string | null = null,
    ): Promise<ReadonlyArray<VectorStamp>> {
        const page = await index.stamps("passage", { workspaceId, sourceId }, { limit: RECONCILE_PAGE, after })
        if (page.next === null) return page.points
        return [...page.points, ...(await this.stampsOfSource(index, workspaceId, sourceId, page.next))]
    }

    /**
     * THE one place rows become points: plans the difference between rows and the points held for them, then removes, rewrites flags,
     * finds a vector for each row that needs one, writes those points, and records in Postgres what the index accepted. Postgres is
     * stamped only AFTER the index acknowledged the write, so `indexed_at` never runs ahead of the index.
     */
    async settle(
        index: VectorIndex,
        kind: VectorKind,
        rows: ReadonlyArray<VectorRow>,
        stamps: ReadonlyArray<VectorStamp>,
        means: VectorSyncMeans,
    ): Promise<VectorSyncDone> {
        return (await this.settleRows(index, kind, rows, stamps, means)).done
    }

    /** The work of `settle`, with the ids of the rows that hold a current point when it ends. */
    private async settleRows(
        index: VectorIndex,
        kind: VectorKind,
        rows: ReadonlyArray<VectorRow>,
        stamps: ReadonlyArray<VectorStamp>,
        means: VectorSyncMeans,
    ): Promise<{ readonly done: VectorSyncDone; readonly current: ReadonlySet<string> }> {
        if (rows.length === 0) return { done: noneDone(), current: new Set() }
        const source = this.sources[kind]
        const model = this.embedder.model()
        const plan = planOf(rows, stamps, model)
        await eachInOrder(byWorkspace(plan.removals), ([workspaceId, gone]) =>
            index.remove(kind, workspaceId, gone.map((row) => row.id)),
        )
        await eachInOrder(byFlags(plan.marks), (group) => index.mark(kind, group.flags.workspaceId, group.ids, group.flags))
        const found = await this.vectorsOf(index, kind, source, plan.needs, model, means)
        const written = plan.needs.filter((row) => found.vectors.has(row.id))
        const points = written.flatMap((row): ReadonlyArray<VectorPoint> => {
            const vector = found.vectors.get(row.id)?.vector
            return vector === undefined ? [] : [{ id: row.id, vector, payload: payloadOfRow(row, model) }]
        })
        await index.upsert(kind, points)
        await eachInOrder(byWorkspace([...written, ...plan.unstamped, ...plan.marks]), ([workspaceId, accepted]) =>
            source.stamp(workspaceId, accepted.map((row) => ({ id: row.id, textHash: row.textHash })), model),
        )
        const origins = [...found.vectors.values()].map((one) => one.origin)
        const count = (origin: VectorOrigin): number => origins.filter((one) => one === origin).length
        return {
            done: {
                unchanged: plan.settled.length + plan.unstamped.length,
                given: count("given"),
                copied: count("copied"),
                adopted: count("adopted"),
                embedded: count("embedded"),
                marked: plan.marks.length,
                removed: plan.removals.length,
                waiting: found.waiting,
                failed: found.failed,
                embedCalls: found.calls,
            },
            current: new Set([...plan.settled, ...plan.unstamped, ...plan.marks, ...written].map((row) => row.id)),
        }
    }

    /**
     * A vector for each row that needs one, cheapest first: the caller's, Postgres's own (the transition), another row's point of the
     * same text, then an embedding call per `SYNC_EMBED_BATCH` rows of one workspace, inside the budget of calls. A vector of another size
     * than the index holds is never written.
     */
    private async vectorsOf(
        index: VectorIndex,
        kind: VectorKind,
        source: VectorRowSource,
        needs: ReadonlyArray<VectorRow>,
        model: string,
        means: VectorSyncMeans,
    ): Promise<VectorsFound> {
        const vectors = new Map<string, { readonly vector: ReadonlyArray<number>; readonly origin: VectorOrigin }>()
        const run = { waiting: 0, failed: 0, calls: 0 }
        for (const row of needs) {
            const vector = means.given?.get(row.id)
            if (vector !== undefined) vectors.set(row.id, { vector, origin: "given" })
        }
        await eachInOrder(byWorkspace(needs.filter((row) => !vectors.has(row.id))), async ([workspaceId, group]) => {
            const stored = await source.storedVectors(workspaceId, group.map((row) => row.id), model)
            for (const [id, vector] of stored) vectors.set(id, { vector, origin: "copied" })
            const rest = group.filter((row) => !vectors.has(row.id))
            if (rest.length === 0) return
            const donors = await source.donors(
                workspaceId,
                [...new Set(rest.map((row) => row.textHash))],
                model,
                rest.map((row) => row.id),
            )
            const lent = donors.size === 0 ? new Map<string, ReadonlyArray<number>>() : await index.vectorsOf(kind, workspaceId, [...new Set(donors.values())])
            for (const row of rest) {
                const vector = lent.get(donors.get(row.textHash) ?? "")
                if (vector !== undefined) vectors.set(row.id, { vector, origin: "adopted" })
            }
            await eachInOrder(
                batchesOf(rest.filter((row) => !vectors.has(row.id)), SYNC_EMBED_BATCH),
                async (batch) => {
                    if (run.failed > 0 || run.calls >= means.embedCalls || !this.embedder.configured()) {
                        run.waiting += batch.length
                        return
                    }
                    run.calls += 1
                    const answer = await this.embedder.embed(workspaceId, batch.map((row) => row.text))
                    if (answer.kind === "blocked") run.waiting += batch.length
                    else if (answer.kind === "failed" || answer.vectors.length !== batch.length) run.failed += batch.length
                    else batch.forEach((row, at) => vectors.set(row.id, { vector: answer.vectors[at] ?? [], origin: "embedded" }))
                },
            )
        })
        return { vectors, ...run }
    }
}
