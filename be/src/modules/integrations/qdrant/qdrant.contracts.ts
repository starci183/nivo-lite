/**
 * What a vector point is of: a kind of Postgres row that declares it is embedded. One collection each: a passage of a workspace's
 * document, a truth of a workspace's truth graph, an item of the platform's base knowledge (tenant `PLATFORM_TENANT`).
 */
export type VectorKind = "passage" | "truth" | "base"

/**
 * WHO a vector search answers for. Every member is required: a search that names no workspace, no audience or no model cannot be
 * written. The index turns it into the filter itself; a caller never hands a filter over.
 */
export interface VectorScope {
    /** The tenant: every search and every count is inside it (a workspace, or `PLATFORM_TENANT` for the platform's own rows). */
    readonly workspaceId: string
    /** customer = only points marked public and customer-ready; internal = every point of the lens. */
    readonly audience: "customer" | "internal"
    /** The reader's module: its own points and those for every module. */
    readonly module: string
    /** The agent instance whose own points join the shared ones; null = the shared ones only. */
    readonly installationId: string | null
    /** The embedding identity (`<model>@<dimensions>`) of the query: only points of it are compared. */
    readonly model: string
    /** in_force = only rows in force (every search that answers a reader); any = waiting rows too (a truth proposal looked up as a candidate, never shown). */
    readonly standing: "in_force" | "any"
}

/**
 * What a point mirrors of its Postgres row: ONLY what a search filters on and what a reconcile compares. Never the text: the text
 * of record stays in Postgres and is read there, by id, after the search.
 */
export interface VectorPayload {
    /** The tenant. */
    readonly workspaceId: string
    /** The document of a passage, or null for a truth. */
    readonly sourceId: string | null
    /** The module the row is for, or null for every module. */
    readonly module: string | null
    /** The agent instance the row is kept for, or null for every instance. */
    readonly installationId: string | null
    /** True when the row may be read by the public (a public passage, a public truth). */
    readonly isPublic: boolean
    /** True when the row is released to customers (the trust gate of a passage; in force and public for a truth). */
    readonly customerReady: boolean
    /** True while the row is in force (a passage always is; a truth while active). */
    readonly inForce: boolean
    /** The embedding identity the vector was made with. */
    readonly model: string
    /** The hash of the text the vector was made from: a point whose hash differs from its row is stale. */
    readonly textHash: string
}

/** The part of the mirror a search filters on: everything but the identity of the vector (its model and the hash of its text). */
export type VectorFlags = Omit<VectorPayload, "model" | "textHash">

/** One point to store: the id of its Postgres row, its vector and the mirror of the row. */
export interface VectorPoint {
    /** The id of the Postgres row (uuid): one point per row, one row per point. */
    readonly id: string
    /** The vector. */
    readonly vector: ReadonlyArray<number>
    /** The mirror of the row. */
    readonly payload: VectorPayload
}

/** One point a search found: the row id and how near it is. Never text. */
export interface VectorMatch {
    /** The id of the Postgres row. */
    readonly id: string
    /** The cosine similarity, 1 = the same direction. */
    readonly score: number
}

/** A point as a sync or a reconcile reads it: its mirror of the row, to compare with the row. Never its vector. */
export interface VectorStamp {
    /** The id of the Postgres row. */
    readonly id: string
    /** The mirror the point holds; a member the point lacks reads as empty (the sync then rewrites it). */
    readonly payload: VectorPayload
}

/** Which points a page of stamps walks: every point of the kind, those of one workspace, or those of one document of it. */
export interface VectorStampFilter {
    /** Only the points of this workspace; absent = every workspace (the reconcile's walk for points whose row is gone). */
    readonly workspaceId?: string
    /** Only the points of this document (passages). */
    readonly sourceId?: string
}

/** Which stretch of the nearest points a search answers. */
export interface VectorSearchPage {
    /** At most this many points. */
    readonly limit: number
    /** After this many nearer points; 0 when absent. */
    readonly offset?: number
}

/** Where a page of stamps starts and how long it is. */
export interface VectorStampCursor {
    /** At most this many points. */
    readonly limit: number
    /** The index's cursor of the page (the `next` of the page before), or null for the first page. */
    readonly after: string | null
}

/** One page of points, in the index's own order. */
export interface VectorStampPage {
    /** The points of the page. */
    readonly points: ReadonlyArray<VectorStamp>
    /** Where the next page starts, or null at the end. */
    readonly next: string | null
}

/** Whether the index answered its last call: ok, or down (it could not be reached). */
export type VectorHealth = "ok" | "down"

/**
 * The vector index of the app: Postgres is the system of record and every point maps one-to-one to a Postgres row (the point id IS
 * the row id). The index answers ids and scores only; the caller reads the rows from Postgres, in its own lens, and drops what
 * Postgres no longer serves, so a lagging index can never leak.
 */
export interface VectorIndex {
    /** Stores points in place of the points of the same ids; idempotent. */
    upsert(kind: VectorKind, points: ReadonlyArray<VectorPoint>): Promise<void>
    /** Removes the points of these row ids of one workspace; an id that has no point is nothing to remove. */
    remove(kind: VectorKind, workspaceId: string, ids: ReadonlyArray<string>): Promise<void>
    /** Rewrites the flags of these points of one workspace and leaves their vectors and identity: rows whose flags changed and whose text did not. */
    mark(kind: VectorKind, workspaceId: string, ids: ReadonlyArray<string>, flags: VectorFlags): Promise<void>
    /** The points nearest to a vector INSIDE the scope, nearest first: at most `limit`, after `offset`. */
    search(
        kind: VectorKind,
        scope: VectorScope,
        vector: ReadonlyArray<number>,
        page: VectorSearchPage,
    ): Promise<ReadonlyArray<VectorMatch>>
    /** How many points the scope holds. */
    count(kind: VectorKind, scope: VectorScope): Promise<number>
    /** One page of the stamps of the points a filter names, for the reconcile and for the sync of one document. */
    stamps(kind: VectorKind, where: VectorStampFilter, page: VectorStampCursor): Promise<VectorStampPage>
    /** The stamps of the points of these row ids, whatever workspace holds them; an id with no point is not answered. */
    stampsOf(kind: VectorKind, ids: ReadonlyArray<string>): Promise<ReadonlyArray<VectorStamp>>
    /** The vectors of these points of one workspace, by id (to adopt the vector of an identical text instead of embedding again). */
    vectorsOf(kind: VectorKind, workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, ReadonlyArray<number>>>
    /**
     * Creates the collection of a kind and its payload indexes when they are missing; safe to repeat. A collection that exists with
     * another vector size or distance is refused (`QDRANT_MISMATCH`): its vectors could not be compared with the app's.
     */
    ensure(kind: VectorKind): Promise<void>
    /** Whether the index answered its last call. */
    health(): VectorHealth
    /** Asks the service now whether it answers an authenticated call (the list of collections): ok or down; never throws. */
    probe(): Promise<VectorHealth>
}
