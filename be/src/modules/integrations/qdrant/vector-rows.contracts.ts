import type { VectorFlags } from "./qdrant.contracts"

/**
 * One Postgres row as the sync reads it: the system of record's side of a point. Postgres holds no vector: the point's vector lives
 * in the index only.
 */
export interface VectorRow {
    /** The row id: the id of its point. */
    readonly id: string
    /** The workspace that owns it. */
    readonly workspaceId: string
    /** True when the row must have a point (every passage; a truth in force or waiting); false = its point is removed. */
    readonly wanted: boolean
    /** The text a vector of the row is made from. */
    readonly text: string
    /** The hash of that text, model-free: a point whose hash differs is stale. */
    readonly textHash: string
    /** What the point must mirror. */
    readonly mirror: VectorFlags
    /** True when Postgres already records that the index accepted a vector of this text under `stampedModel`. */
    readonly stamped: boolean
    /** The embedding identity Postgres records for the row, or null. */
    readonly stampedModel: string | null
}

/** Where a page of rows starts: the id of the last row of the page before, or null for the first page. */
export type VectorRowCursor = string | null

/** A row that exists and wants a point, as the walk over the points asks for it. */
export interface WantedRow {
    /** The row id. */
    readonly id: string
    /** The workspace that owns it. */
    readonly workspaceId: string
}

/** One row whose point the index accepted: what Postgres records of it. */
export interface AcceptedRow {
    /** The row id. */
    readonly id: string
    /** The hash of the text the accepted vector was made from. */
    readonly textHash: string
}

/**
 * The Postgres side of one kind of point, owned by the capability that owns the table (passages: knowledge-chunks; truths:
 * brain-facts; base knowledge: nivo-knowledge): how a row kind declares that it is embedded. The sync asks it for rows and tells it
 * what the index accepted; Postgres never holds a vector.
 */
export interface VectorRowSource {
    /** The rows of one workspace with these ids; an id with no row is not answered. */
    byIds(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<VectorRow>>
    /** Every row of one document of a workspace (passages); nothing for a kind that has no documents. */
    ofSource(workspaceId: string, sourceId: string): Promise<ReadonlyArray<VectorRow>>
    /** One page of every row of the kind, whatever workspace, in id order after `afterId`: the reconcile's walk. */
    page(afterId: VectorRowCursor, limit: number): Promise<ReadonlyArray<VectorRow>>
    /** Among these ids, the rows that exist and want a point, whatever workspace. */
    wantedAmong(ids: ReadonlyArray<string>): Promise<ReadonlyArray<WantedRow>>
    /**
     * For each of these text hashes, ANOTHER row of the workspace whose point the index accepted for the same text under this
     * identity: its vector is adopted with no embedding call. A hash with no such row is not answered.
     */
    donors(
        workspaceId: string,
        hashes: ReadonlyArray<string>,
        model: string,
        exceptIds: ReadonlyArray<string>,
    ): Promise<ReadonlyMap<string, string>>
    /** Records that the index accepted the vectors of these rows under this identity (`indexed_at`, the identity, the hash). */
    stamp(workspaceId: string, accepted: ReadonlyArray<AcceptedRow>, model: string): Promise<void>
}
