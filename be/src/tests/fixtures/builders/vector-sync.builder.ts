import type {
    AcceptedRow,
    VectorFlags,
    VectorHealth,
    VectorIndex,
    VectorKind,
    VectorMatch,
    VectorPayload,
    VectorPoint,
    VectorRow,
    VectorRowSource,
    VectorStamp,
    VectorStampCursor,
    VectorStampFilter,
    VectorStampPage,
    WantedRow,
} from "@modules/integrations/qdrant"
import type { VectorEmbedder, VectorsEmbedded } from "@modules/domain/vector-sync"

/** The identity the scripted embedder makes vectors with. */
export const TEST_MODEL = "text-embedding-3-small@1536"

/** The error a scripted index that is down throws. */
export class IndexDown extends Error {}

/**
 * A scripted vector index, in memory: no network. It keeps points per kind, counts every call, and can be switched down (every call
 * throws) to play an outage.
 */
export class FakeVectorIndex implements VectorIndex {
    readonly points: Record<VectorKind, Map<string, VectorPoint>> = { passage: new Map(), truth: new Map() }
    readonly calls: Record<string, number> = {}
    /** How many points each write carried: the REST client sends them 64 at a time. */
    readonly upsertSizes: Array<number> = []
    down = false

    private called(name: string): void {
        this.calls[name] = (this.calls[name] ?? 0) + 1
        if (this.down) throw new IndexDown(name)
    }

    health(): VectorHealth {
        return this.down ? "down" : "ok"
    }

    ensure(): Promise<void> {
        this.called("ensure")
        return Promise.resolve()
    }

    upsert(kind: VectorKind, points: ReadonlyArray<VectorPoint>): Promise<void> {
        if (points.length === 0) return Promise.resolve()
        this.called("upsert")
        this.upsertSizes.push(points.length)
        for (const point of points) this.points[kind].set(point.id, point)
        return Promise.resolve()
    }

    remove(kind: VectorKind, workspaceId: string, ids: ReadonlyArray<string>): Promise<void> {
        this.called("remove")
        for (const id of ids) if (this.points[kind].get(id)?.payload.workspaceId === workspaceId) this.points[kind].delete(id)
        return Promise.resolve()
    }

    mark(kind: VectorKind, workspaceId: string, ids: ReadonlyArray<string>, flags: VectorFlags): Promise<void> {
        this.called("mark")
        for (const id of ids) {
            const point = this.points[kind].get(id)
            if (point?.payload.workspaceId === workspaceId) {
                this.points[kind].set(id, { ...point, payload: { ...point.payload, ...flags } })
            }
        }
        return Promise.resolve()
    }

    search(): Promise<ReadonlyArray<VectorMatch>> {
        this.called("search")
        return Promise.resolve([])
    }

    count(kind: VectorKind): Promise<number> {
        this.called("count")
        return Promise.resolve(this.points[kind].size)
    }

    stamps(
        kind: VectorKind,
        where: VectorStampFilter,
        page: VectorStampCursor,
    ): Promise<VectorStampPage> {
        this.called("stamps")
        const all = [...this.points[kind].values()]
            .filter(
                (point) =>
                    (where.workspaceId === undefined || point.payload.workspaceId === where.workspaceId) &&
                    (where.sourceId === undefined || point.payload.sourceId === where.sourceId),
            )
            .map((point) => point.id)
            .toSorted((a, b) => a.localeCompare(b))
        const from = page.after === null ? 0 : all.findIndex((id) => id >= (page.after ?? ""))
        const ids = from < 0 ? [] : all.slice(from, from + page.limit)
        const next = from < 0 ? undefined : all[from + page.limit]
        return Promise.resolve({ points: ids.flatMap((id) => this.stampOf(kind, id)), next: next ?? null })
    }

    stampsOf(kind: VectorKind, ids: ReadonlyArray<string>): Promise<ReadonlyArray<VectorStamp>> {
        this.called("stampsOf")
        return Promise.resolve(ids.flatMap((id) => this.stampOf(kind, id)))
    }

    vectorsOf(kind: VectorKind, workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, ReadonlyArray<number>>> {
        this.called("vectorsOf")
        return Promise.resolve(
            new Map(
                ids.flatMap((id): ReadonlyArray<readonly [string, ReadonlyArray<number>]> => {
                    const point = this.points[kind].get(id)
                    return point?.payload.workspaceId === workspaceId ? [[id, point.vector]] : []
                }),
            ),
        )
    }

    /** The mirror a kind holds for a row id, or undefined. */
    payloadOf(kind: VectorKind, id: string): VectorPayload | undefined {
        return this.points[kind].get(id)?.payload
    }

    private stampOf(kind: VectorKind, id: string): ReadonlyArray<VectorStamp> {
        const point = this.points[kind].get(id)
        return point === undefined ? [] : [{ id, payload: point.payload }]
    }
}

/** A row of the scripted Postgres side. */
export const vectorRowOf = (id: string, workspaceId: string, over: Partial<VectorRow> = {}): VectorRow => ({
    id,
    workspaceId,
    wanted: true,
    text: `text of ${id}`,
    textHash: `hash-${id}`,
    mirror: {
        workspaceId,
        sourceId: null,
        module: null,
        installationId: null,
        isPublic: false,
        customerReady: false,
        inForce: true,
    },
    stamped: false,
    stampedModel: null,
    ...over,
})

/** A scripted Postgres side of one kind: rows in memory, what the index accepted, and the vectors Postgres still holds. */
export class FakeRowSource implements VectorRowSource {
    readonly rows: Map<string, VectorRow> = new Map()
    readonly stored: Map<string, ReadonlyArray<number>> = new Map()
    readonly calls: Record<string, number> = {}

    private called(name: string): void {
        this.calls[name] = (this.calls[name] ?? 0) + 1
    }

    put(...rows: ReadonlyArray<VectorRow>): void {
        for (const row of rows) this.rows.set(row.id, row)
    }

    byIds(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<VectorRow>> {
        this.called("byIds")
        return Promise.resolve(
            ids.flatMap((id) => {
                const row = this.rows.get(id)
                return row?.workspaceId === workspaceId ? [row] : []
            }),
        )
    }

    ofSource(workspaceId: string, sourceId: string): Promise<ReadonlyArray<VectorRow>> {
        this.called("ofSource")
        return Promise.resolve(
            [...this.rows.values()].filter((row) => row.workspaceId === workspaceId && row.mirror.sourceId === sourceId),
        )
    }

    page(afterId: string | null, limit: number): Promise<ReadonlyArray<VectorRow>> {
        this.called("page")
        const ids = this.sortedIds()
        const from = afterId === null ? 0 : ids.findIndex((id) => id > afterId)
        return Promise.resolve(from < 0 ? [] : ids.slice(from, from + limit).flatMap((id) => this.rows.get(id) ?? []))
    }

    wantedAmong(ids: ReadonlyArray<string>): Promise<ReadonlyArray<WantedRow>> {
        this.called("wantedAmong")
        return Promise.resolve(
            ids.flatMap((id) => {
                const row = this.rows.get(id)
                return row?.wanted === true ? [{ id, workspaceId: row.workspaceId }] : []
            }),
        )
    }

    storedVectors(_workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, ReadonlyArray<number>>> {
        this.called("storedVectors")
        return Promise.resolve(
            new Map(
                ids.flatMap((id): ReadonlyArray<readonly [string, ReadonlyArray<number>]> => {
                    const vector = this.stored.get(id)
                    return vector === undefined ? [] : [[id, vector]]
                }),
            ),
        )
    }

    donors(
        workspaceId: string,
        hashes: ReadonlyArray<string>,
        model: string,
        exceptIds: ReadonlyArray<string>,
    ): Promise<ReadonlyMap<string, string>> {
        this.called("donors")
        const donors = new Map<string, string>()
        for (const row of this.rows.values()) {
            const lends = row.workspaceId === workspaceId && row.stamped && row.stampedModel === model && !exceptIds.includes(row.id)
            if (lends && hashes.includes(row.textHash) && !donors.has(row.textHash)) donors.set(row.textHash, row.id)
        }
        return Promise.resolve(donors)
    }

    stamp(_workspaceId: string, accepted: ReadonlyArray<AcceptedRow>, model: string): Promise<void> {
        this.called("stamp")
        for (const one of accepted) {
            const row = this.rows.get(one.id)
            if (row !== undefined) this.rows.set(one.id, { ...row, stamped: true, stampedModel: model })
        }
        return Promise.resolve()
    }

    private sorted: ReadonlyArray<string> | null = null

    /** The ids in order; cached until the number of rows changes (a walk over 200,000 rows sorts once). */
    private sortedIds(): ReadonlyArray<string> {
        if (this.sorted?.length !== this.rows.size) {
            this.sorted = [...this.rows.keys()].toSorted((a, b) => a.localeCompare(b))
        }
        return this.sorted
    }
}

/** A scripted embedding door: a vector per text, counted; it can be blocked (no credits), failing, or not configured. */
export class FakeEmbedder implements VectorEmbedder {
    calls = 0
    texts = 0
    answer: "vectors" | "blocked" | "failed" = "vectors"
    on = true

    configured(): boolean {
        return this.on
    }

    model(): string {
        return TEST_MODEL
    }

    embed(_workspaceId: string, texts: ReadonlyArray<string>): Promise<VectorsEmbedded> {
        this.calls += 1
        if (this.answer !== "vectors") return Promise.resolve({ kind: this.answer })
        this.texts += texts.length
        return Promise.resolve({ kind: "vectors", vectors: texts.map((text) => [text.length, 1]) })
    }
}
