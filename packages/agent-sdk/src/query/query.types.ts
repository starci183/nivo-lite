/**
 * PINNED by the CORE-BE lead (2026-11-05). The typed query tree: data only, never SQL text (plan section 2.3, R334).
 * Copied verbatim into every wave-2 stream; only E2 (and the lead) change it, announced in CORE-BE.log.md first.
 * A field name is an entity field name; `<jsonbField>.<key>` names a declared custom key (plan section 10).
 */

export type Scalar = string | number | boolean | null

export type CompareOp = "eq" | "ne" | "lt" | "lte" | "gt" | "gte"

export type FilterExpr =
    /** Compare a field with a value, or with another field (`ref`), never both. */
    | { readonly op: CompareOp; readonly field: string; readonly value?: Scalar; readonly ref?: string }
    /** At most 500 values. */
    | { readonly op: "in" | "notIn"; readonly field: string; readonly values: ReadonlyArray<Scalar> }
    | { readonly op: "isNull" | "notNull"; readonly field: string }
    /** public.knowledge_fold(field) LIKE public.knowledge_fold(text), escaped; text at most 200 chars. */
    | { readonly op: "search"; readonly fields: ReadonlyArray<string>; readonly text: string }
    /** tstzrange(range[0], range[1]) && tstzrange(from, to). */
    | { readonly op: "overlaps"; readonly range: readonly [string, string]; readonly from: string; readonly to: string }
    /** Depth at most 6, width at most 32. */
    | { readonly op: "and" | "or"; readonly of: ReadonlyArray<FilterExpr> }
    | { readonly op: "not"; readonly of: FilterExpr }
    /** A toMany relation has a row matching `where`. */
    | { readonly op: "has"; readonly relation: string; readonly where?: FilterExpr }

export type OrderBy = ReadonlyArray<readonly [string, "asc" | "desc"]>

/** A toMany include: the rows of one relation, at most `latest` (<= 20) per parent, one extra query per page (R77). */
export interface IncludeSpec {
    readonly relation: string
    readonly select: ReadonlyArray<string>
    readonly order: OrderBy
    readonly latest: number
}

export interface Query<E extends string = string> {
    /** The entity name. */
    readonly from: E
    readonly select: ReadonlyArray<string>
    /** toOne relations joined in the same statement, each with its selected fields. */
    readonly join?: Readonly<Record<string, ReadonlyArray<string>>>
    readonly include?: ReadonlyArray<IncludeSpec>
    readonly where?: FilterExpr
    /** Ends with the entity key (keyset paging needs a total order). */
    readonly order: OrderBy
    /** size 1..100; `after` the opaque scoped cursor. */
    readonly page: { readonly size: number; readonly after?: string }
}

export type MeasureKind = "count" | "sum" | "min" | "max" | "avg"

export interface Aggregate<E extends string = string> {
    readonly from: E
    readonly where?: FilterExpr
    /** At most 3 fields. */
    readonly groupBy?: ReadonlyArray<string>
    readonly measures: Readonly<Record<string, { readonly kind: MeasureKind; readonly field?: string }>>
    readonly bucket?: { readonly field: string; readonly unit: "day" | "week" | "month" }
    /** At most 1000 groups. */
    readonly limit: number
}

export type QueryProblemCode =
    | "QUERY_ENTITY_UNKNOWN"
    | "QUERY_FIELD_UNKNOWN"
    | "QUERY_RELATION_UNKNOWN"
    | "QUERY_OP_INVALID"
    | "QUERY_BOUND_EXCEEDED"
    | "QUERY_ORDER_NOT_TOTAL"
    | "QUERY_NOT_INDEXED"
    | "QUERY_CUSTOM_KEY_UNDECLARED"
    | "QUERY_OWNER_FIELD"

export interface QueryProblem {
    readonly code: QueryProblemCode
    readonly at: string
}

/** The bounds every tree obeys (R69, R305). */
export const QUERY_BOUNDS = {
    pageSize: 100,
    inValues: 500,
    searchText: 200,
    depth: 6,
    width: 32,
    groupBy: 3,
    groups: 1000,
    includeLatest: 20,
} as const
