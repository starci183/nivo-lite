import { RELATION_KINDS } from "./brain-facts.contracts"
import type { FactRelation, Instant, RelationInput, RelationKind } from "./brain-facts.contracts"

/** The longest label of a relation, in characters. */
export const RELATION_LABEL_MAX = 80

/** The most edges one read answers. */
export const RELATION_READ_MAX = 500

/** The kinds as text, for the check of a value that came from outside. */
const KNOWN_KINDS: ReadonlySet<string> = new Set(RELATION_KINDS)

/** An edge ready to store: two different facts, a known kind, a trimmed label or none, who made it. */
export interface CheckedRelation {
    /** The fact it starts from. */
    readonly fromFactId: string
    /** The fact it points at. */
    readonly toFactId: string
    /** How they relate. */
    readonly kind: RelationKind
    /** The label, or null. */
    readonly label: string | null
    /** Who made it. */
    readonly createdBy: string
}

/** Why an edge cannot be stored. */
export type RelationRefusal = "self" | "kind" | "label"

/** A relation input after trimming, or the reason it cannot be stored. */
export type RelationCheck =
    | { readonly ok: true; readonly relation: CheckedRelation }
    | { readonly ok: false; readonly reason: RelationRefusal }

/** The two ends of an edge. */
export interface EdgeEnds {
    /** The start. */
    readonly fromFactId: string
    /** The end. */
    readonly toFactId: string
}

/** A fact id, or null. */
export type MaybeFactId = string | null

/** Whether a text names a relation kind. */
export const isRelationKind = (kind: string): kind is RelationKind => KNOWN_KINDS.has(kind)

/** Checks an edge before it is stored: two different facts, a known kind, a short label. */
export const checkRelation = (input: RelationInput): RelationCheck => {
    if (input.fromFactId === input.toFactId) return { ok: false, reason: "self" }
    if (!isRelationKind(input.kind)) return { ok: false, reason: "kind" }
    const label = input.label?.trim() ?? ""
    if (label.length > RELATION_LABEL_MAX) return { ok: false, reason: "label" }
    const createdBy = input.createdBy.trim().slice(0, 120)
    return {
        ok: true,
        relation: {
            fromFactId: input.fromFactId,
            toFactId: input.toFactId,
            kind: input.kind,
            createdBy: createdBy === "" ? "NIVO" : createdBy,
            label: label === "" ? null : label,
        },
    }
}

/** A stored relation as the store reads it. */
export interface StoredRelation {
    /** The id. */
    readonly id: string
    /** The start. */
    readonly fromFactId: string
    /** The end. */
    readonly toFactId: string
    /** The kind. */
    readonly kind: RelationKind
    /** The label. */
    readonly label: string | null
    /** Who made it. */
    readonly createdBy: string
    /** When. */
    readonly createdAt: Instant
}

/** A relation as the callers read it. */
export const toFactRelation = (row: StoredRelation): FactRelation => ({
    id: row.id,
    fromFactId: row.fromFactId,
    toFactId: row.toFactId,
    kind: row.kind,
    label: row.label,
    createdBy: row.createdBy,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
})

/** The other end of an edge seen from one fact, or null when the edge does not touch it. */
export const otherEnd = (relation: EdgeEnds, factId: string): MaybeFactId => {
    if (relation.fromFactId === factId) return relation.toFactId
    if (relation.toFactId === factId) return relation.fromFactId
    return null
}

/**
 * The edges a replacement takes over: each edge of the old value with the new value in its place, never an edge between the two values
 * themselves (it would join the new value to itself or to its own history).
 */
export const carriedRelationsOf = (
    edges: ReadonlyArray<FactRelation>,
    oldId: string,
    newId: string,
): ReadonlyArray<CheckedRelation> =>
    edges.flatMap((edge) => {
        if (edge.fromFactId === newId || edge.toFactId === newId) return []
        const fromFactId = edge.fromFactId === oldId ? newId : edge.fromFactId
        const toFactId = edge.toFactId === oldId ? newId : edge.toFactId
        if (fromFactId === toFactId) return []
        return [{ fromFactId, toFactId, kind: edge.kind, label: edge.label, createdBy: edge.createdBy }]
    })
