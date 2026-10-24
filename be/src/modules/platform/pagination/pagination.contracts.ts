/** The requested forward page; omitted or null values select the first page and its default size. */
export interface PageRequest {
    /** The number of nodes requested, from one through the shared maximum. */
    readonly first?: number | null | undefined
    /** The opaque cursor of the previous page's last node. */
    readonly after?: string | null | undefined
}

/** The immutable database position, retaining the timestamp's full precision. */
export interface PagePosition {
    /** The creation timestamp as emitted by PostgreSQL. */
    readonly createdAt: string
    /** The unique id that breaks timestamp ties. */
    readonly id: string
}

/** A validated page ready for a keyset query fetching first plus one rows. */
export interface NormalizedPage {
    /** The bounded number of nodes to return. */
    readonly first: number
    /** The exclusive lower position, or null for the newest page. */
    readonly after: PagePosition | null
}

/** The common keyset SQL arguments: exact timestamp, tie-breaking id, and the lookahead limit. */
export type PageQueryParameters = readonly [createdAt: string | null, id: string | null, limit: number]

/** The exact database position selected by each main list's SQL projection. */
export interface CreatedPageRow {
    /** The unique tie-breaking id. */
    readonly id: string
    /** PostgreSQL's creation timestamp as text, including microseconds. */
    readonly created_at: string
}

/** Reads one exact keyset position from a node before its timestamps are mapped for display. */
export type PagePositionOf<T> = (node: T) => PagePosition

/** Queries a list owner's SQL with the shared exclusive seek position and lookahead limit. */
export type ReadPageRows<T extends CreatedPageRow> = (parameters: PageQueryParameters) => Promise<ReadonlyArray<T>>

/** The continuation of a forward connection. */
export interface PageInfo {
    /** The cursor of the last returned node, or null for an empty page. */
    readonly endCursor: string | null
    /** Whether the query found a further node beyond the requested page. */
    readonly hasNextPage: boolean
}

/** A bounded list and the information needed to continue reading it. */
export interface Connection<T> {
    /** The requested nodes in stable database order. */
    readonly nodes: ReadonlyArray<T>
    /** The cursor and existence of the next page. */
    readonly pageInfo: PageInfo
}
