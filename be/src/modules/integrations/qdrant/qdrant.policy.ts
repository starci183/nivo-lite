import { isRecord } from "@modules/platform/primitives"
import type {
    VectorFlags,
    VectorKind,
    VectorMatch,
    VectorPayload,
    VectorPoint,
    VectorScope,
    VectorStamp,
    VectorStampFilter,
} from "./qdrant.contracts"

/** The collection of each kind of point: two kinds never share one (other filters, other sizes, rebuilt alone). */
export const COLLECTION_OF: Readonly<Record<VectorKind, string>> = {
    passage: "nivo_passages",
    truth: "nivo_truths",
    base: "nivo_base",
}

/** The kinds of point, in the order they are prepared at boot. */
export const VECTOR_KINDS: ReadonlyArray<VectorKind> = ["passage", "truth", "base"]

/**
 * The tenant of a row no workspace owns (the platform's base knowledge): its points name it as their workspace, so the tenant filter
 * of every search and removal holds for them too. It is not a uuid: no workspace can ever carry it, and the queue does not count its
 * jobs against a workspace; the embedding of its rows is the platform's, not metered against a workspace.
 */
export const PLATFORM_TENANT = "platform"

/** The distance every collection compares with. */
export const DISTANCE = "Cosine"

/** The most points one search answers. */
export const SEARCH_MAX = 100

/** The most points one removal, one read by ids or one page of stamps carries. */
export const BATCH_MAX = 256

/** The most points one write carries: 64 vectors of 1536 numbers are about 1.2 MB of JSON, well inside one call's time limit. */
export const UPSERT_MAX = 64

/** The value a Qdrant condition matches a payload key against. */
export interface QdrantMatchValue {
    /** The exact string or flag the key must hold. */
    readonly value: string | boolean
}

/** The payload key a Qdrant condition requires to be null. */
export interface QdrantNullKey {
    /** The payload key. */
    readonly key: string
}

/** One condition of a Qdrant filter. */
export type QdrantCondition =
    | { readonly key: string; readonly match: QdrantMatchValue }
    | { readonly is_null: QdrantNullKey }
    | { readonly has_id: ReadonlyArray<string> }
    | { readonly should: ReadonlyArray<QdrantCondition> }

/** A Qdrant filter: every `must` condition holds. */
export interface QdrantFilter {
    /** The conditions; a point is matched when every one holds. */
    readonly must: ReadonlyArray<QdrantCondition>
}

const equals = (key: string, value: string | boolean): QdrantCondition => ({ key, match: { value } })

/** A nullable member of the lens: the points for everyone (null) and the reader's own. */
const sharedOr = (key: string, own: string | null): QdrantCondition => ({
    should: [{ is_null: { key } }, ...(own === null ? [] : [equals(key, own)])],
})

/**
 * THE FILTER of a search or a count, built here and nowhere else: the tenant, the embedding identity, rows in force (unless the scope
 * asks for waiting rows too), the reader's module and instance, and for a customer audience public and customer-ready points only.
 * There is no way to search without it.
 */
export const filterOf = (scope: VectorScope): QdrantFilter => ({
    must: [
        equals("workspace_id", scope.workspaceId),
        equals("model", scope.model),
        ...(scope.standing === "in_force" ? [equals("in_force", true)] : []),
        sharedOr("module", scope.module),
        sharedOr("installation_id", scope.installationId),
        ...(scope.audience === "customer" ? [equals("is_public", true), equals("customer_ready", true)] : []),
    ],
})

/** The filter of a workspace's own points, for a removal, a rewrite of mirrors or a read of vectors: the tenant, and the ids when named. */
export const ownedFilterOf = (workspaceId: string, ids?: ReadonlyArray<string>): QdrantFilter => ({
    must: [equals("workspace_id", workspaceId), ...(ids === undefined ? [] : [{ has_id: [...ids] }])],
})

/** The filter of a page of stamps: every point, a workspace's, or one document's. */
export const stampFilterOf = (where: VectorStampFilter): QdrantFilter => ({
    must: [
        ...(where.workspaceId === undefined ? [] : [equals("workspace_id", where.workspaceId)]),
        ...(where.sourceId === undefined ? [] : [equals("source_id", where.sourceId)]),
    ],
})

/** The flags of a point as Qdrant stores them: snake case; what a rewrite of flags sends (the identity of the vector stays). */
export const flagsOf = (flags: VectorFlags): Readonly<Record<string, string | boolean | null>> => ({
    workspace_id: flags.workspaceId,
    source_id: flags.sourceId,
    module: flags.module,
    installation_id: flags.installationId,
    is_public: flags.isPublic,
    customer_ready: flags.customerReady,
    in_force: flags.inForce,
})

/** The payload of a point as Qdrant stores it: snake case, the mirror of the row and nothing else. */
export const payloadOf = (payload: VectorPayload): Readonly<Record<string, string | boolean | null>> => ({
    ...flagsOf(payload),
    model: payload.model,
    text_hash: payload.textHash,
})

/** A point as Qdrant takes it. */
export const pointOf = (point: VectorPoint): Readonly<Record<string, unknown>> => ({
    id: point.id,
    vector: [...point.vector],
    payload: payloadOf(point.payload),
})

/** The payload members a search and a reconcile filter on, each with its Qdrant schema; the tenant is marked as such. */
export const PAYLOAD_INDEXES: ReadonlyArray<{ readonly field: string; readonly schema: Readonly<Record<string, unknown>> }> = [
    { field: "workspace_id", schema: { type: "keyword", is_tenant: true } },
    { field: "model", schema: { type: "keyword" } },
    { field: "module", schema: { type: "keyword" } },
    { field: "installation_id", schema: { type: "keyword" } },
    { field: "source_id", schema: { type: "keyword" } },
    { field: "is_public", schema: { type: "bool" } },
    { field: "customer_ready", schema: { type: "bool" } },
    { field: "in_force", schema: { type: "bool" } },
]

/** The points of an answer (`result.points` of a query or a scroll, or `result` itself of a read by ids), or nothing. */
const pointsOf = (body: unknown): ReadonlyArray<Readonly<Record<string, unknown>>> => {
    const result = isRecord(body) ? body.result : undefined
    if (Array.isArray(result)) return result.filter(isRecord)
    const list: unknown = isRecord(result) ? result.points : undefined
    return Array.isArray(list) ? list.filter(isRecord) : []
}

/** The matches of a query answer: id and score; a point with no text id or no number score is left out. */
export const matchesOf = (body: unknown): ReadonlyArray<VectorMatch> =>
    pointsOf(body).flatMap((point) =>
        typeof point.id === "string" && typeof point.score === "number" ? [{ id: point.id, score: point.score }] : [],
    )

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

const optionalTextOf = (value: unknown): string | null => (typeof value === "string" ? value : null)

/** The mirror a stored payload holds; a member that is missing reads as empty or false, so the sync sees it differ and rewrites it. */
export const mirrorOf = (payload: Readonly<Record<string, unknown>>): VectorPayload => ({
    workspaceId: textOf(payload.workspace_id),
    sourceId: optionalTextOf(payload.source_id),
    module: optionalTextOf(payload.module),
    installationId: optionalTextOf(payload.installation_id),
    isPublic: payload.is_public === true,
    customerReady: payload.customer_ready === true,
    inForce: payload.in_force === true,
    model: textOf(payload.model),
    textHash: textOf(payload.text_hash),
})

/** The stamps of a scroll or of a read by ids: each point's id and its mirror. */
export const stampsOf = (body: unknown): ReadonlyArray<VectorStamp> =>
    pointsOf(body).flatMap((point) =>
        typeof point.id === "string" ? [{ id: point.id, payload: mirrorOf(isRecord(point.payload) ? point.payload : {}) }] : [],
    )

/** Where the next page of a scroll starts, or null. */
export const nextOf = (body: unknown): string | null => {
    const result = isRecord(body) ? body.result : undefined
    const next = isRecord(result) ? result.next_page_offset : undefined
    return typeof next === "string" ? next : null
}

/** The count of a count answer, or 0. */
export const countOf = (body: unknown): number => {
    const result = isRecord(body) ? body.result : undefined
    const count = isRecord(result) ? result.count : undefined
    return typeof count === "number" ? count : 0
}

/** The vectors of a scroll answer, by point id. */
export const vectorsOf = (body: unknown): ReadonlyMap<string, ReadonlyArray<number>> =>
    new Map(
        pointsOf(body).flatMap((point): ReadonlyArray<readonly [string, ReadonlyArray<number>]> => {
            const vector: unknown = point.vector
            if (typeof point.id !== "string" || !Array.isArray(vector)) return []
            return [[point.id, vector.filter((value): value is number => typeof value === "number")]]
        }),
    )

/** What a collection compares with, read from its description: the vector size and the distance; null when the answer names none. */
export const shapeOf = (body: unknown): { readonly size: number; readonly distance: string } | null => {
    const result = isRecord(body) ? body.result : undefined
    const config = isRecord(result) ? result.config : undefined
    const params = isRecord(config) ? config.params : undefined
    const vectors = isRecord(params) ? params.vectors : undefined
    if (!isRecord(vectors) || typeof vectors.size !== "number" || typeof vectors.distance !== "string") return null
    return { size: vectors.size, distance: vectors.distance }
}
