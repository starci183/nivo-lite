/**
 * Owned by the CORE-BE lead (2026-11-05, plan section 11: one `records` table). The typed query tree: data only, never SQL text
 * (plan 2.3, R334). Copied verbatim into every wave-2 stream; only E2 (and the lead) change it, announced in CORE-BE.log.md first.
 * A field name is a declared field (stored in `data`), a system field (`id`, `workspaceId`, `version`, `createdAt`, `updatedAt`) or
 * `<jsonbField>.<key>` naming a declared nested key (plan 10). The bounds live in `query-bounds.ts`.
 */

/** A literal a filter compares with. */
export type Scalar = string | number | boolean | null

/** The comparison operators. */
export type CompareOp = "eq" | "ne" | "lt" | "lte" | "gt" | "gte"

/** Compare a field with a value, or with another field (`ref`), never both. */
export interface CompareExpr {
    /** The operator. */
    readonly op: CompareOp
    /** The field compared. */
    readonly field: string
    /** The literal compared with. */
    readonly value?: Scalar
    /** The other field compared with. */
    readonly ref?: string
}

/** The field is (not) one of at most 500 values. */
export interface MembershipExpr {
    /** The operator. */
    readonly op: "in" | "notIn"
    /** The field compared. */
    readonly field: string
    /** At most 500 values. */
    readonly values: ReadonlyArray<Scalar>
}

/** The field is (not) null. */
export interface NullCheckExpr {
    /** The operator. */
    readonly op: "isNull" | "notNull"
    /** The field checked. */
    readonly field: string
}

/** `public.knowledge_fold(field) LIKE public.knowledge_fold(text)`, escaped. */
export interface SearchExpr {
    /** The operator. */
    readonly op: "search"
    /** The text fields searched. */
    readonly fields: ReadonlyArray<string>
    /** The text, at most 200 characters. */
    readonly text: string
}

/** `tstzrange(range[0], range[1]) && tstzrange(from, to)`. */
export interface OverlapsExpr {
    /** The operator. */
    readonly op: "overlaps"
    /** The two timestamptz fields of the row. */
    readonly range: readonly [string, string]
    /** The start of the window. */
    readonly from: string
    /** The end of the window. */
    readonly to: string
}

/** And / or of expressions: depth at most 6, width at most 32. */
export interface GroupExpr {
    /** The operator. */
    readonly op: "and" | "or"
    /** The operands. */
    readonly of: ReadonlyArray<FilterExpr>
}

/** The negation of an expression. */
export interface NotExpr {
    /** The operator. */
    readonly op: "not"
    /** The negated expression. */
    readonly of: FilterExpr
}

/** A record linked through a toMany relation matches `where`. */
export interface HasExpr {
    /** The operator. */
    readonly op: "has"
    /** The toMany relation (record_links). */
    readonly relation: string
    /** The condition on the linked record. */
    readonly where?: FilterExpr
}

/** A condition on a record. */
export type FilterExpr =
    CompareExpr | MembershipExpr | NullCheckExpr | SearchExpr | OverlapsExpr | GroupExpr | NotExpr | HasExpr

/** The way an order key runs: `asc` smallest first, `desc` largest first (keyset paging reads both). */
export type SortDirection = "asc" | "desc"

/** One key of an order: a field and its direction. */
export type OrderKey = readonly [string, SortDirection]

/** An order; a list query's order ends with `id` (keyset paging needs a total order). */
export type OrderBy = ReadonlyArray<OrderKey>

/** A toMany include: the records of one relation, at most `latest` (<= 20) per parent, one extra query per page (R77). */
export interface IncludeSpec {
    /** The toMany relation. */
    readonly relation: string
    /** The fields of the linked records. */
    readonly select: ReadonlyArray<string>
    /** The order of the linked records, ending with `id`. */
    readonly order: OrderBy
    /** How many records per parent, 1..20. */
    readonly latest: number
}

/** The page of a list query: size 1..100; `after` the opaque scoped cursor. */
export interface PageSpec {
    /** The rows of a page. */
    readonly size: number
    /** The opaque cursor of the page to load. */
    readonly after?: string
}

/** A list query over one entity. */
export interface Query<E extends string = string> {
    /** The entity name. */
    readonly from: E
    /** The fields of each row. */
    readonly select: ReadonlyArray<string>
    /** toOne relations joined in the same statement, each with its selected fields. */
    readonly join?: Readonly<Record<string, ReadonlyArray<string>>>
    /** toMany relations included, one extra query per relation per page. */
    readonly include?: ReadonlyArray<IncludeSpec>
    /** The condition. */
    readonly where?: FilterExpr
    /** Ends with `id`. */
    readonly order: OrderBy
    /** The page. */
    readonly page: PageSpec
}

/** The aggregate functions. */
export type MeasureKind = "count" | "sum" | "min" | "max" | "avg"

/** One measure of an aggregate; its own `where` narrows what it counts (a per-case count in one statement). */
export interface MeasureSpec {
    /** The function. */
    readonly kind: MeasureKind
    /** The field aggregated; count may omit it. */
    readonly field?: string
    /** Only the records matching this are aggregated (`FILTER (WHERE ...)`). */
    readonly where?: FilterExpr
}

/** A time bucket of an aggregate. */
export interface BucketSpec {
    /** The timestamptz or date field. */
    readonly field: string
    /** The bucket size. */
    readonly unit: "day" | "week" | "month"
}

/** An aggregate over one entity. */
export interface Aggregate<E extends string = string> {
    /** The entity name. */
    readonly from: E
    /** The condition. */
    readonly where?: FilterExpr
    /** At most 3 fields. */
    readonly groupBy?: ReadonlyArray<string>
    /** The measures by name. */
    readonly measures: Readonly<Record<string, MeasureSpec>>
    /** A time bucket. */
    readonly bucket?: BucketSpec
    /** At most 1000 groups. */
    readonly limit: number
}

/** The codes `queryProblems` reports. */
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

/** One problem of a tree. */
export interface QueryProblem {
    /** The code. */
    readonly code: QueryProblemCode
    /** The path inside the tree. */
    readonly at: string
}
