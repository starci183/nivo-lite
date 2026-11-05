import type { CompareOp, FilterExpr, IncludeSpec, OrderBy, Query, Scalar } from "./query.types"

const compare =
    (op: CompareOp) =>
    (field: string, value: Scalar): FilterExpr => ({ op, field, value })
const compareRef =
    (op: CompareOp) =>
    (field: string, ref: string): FilterExpr => ({ op, field, ref })

/** The immutable builder of a list query: each step returns a new builder, `page` ends it with the tree. */
export interface ListBuilder {
    /** The fields the rows carry. */
    readonly select: (...fields: ReadonlyArray<string>) => ListBuilder
    /** Join a toOne relation, selecting these fields of its target. */
    readonly join: (relation: string, ...fields: ReadonlyArray<string>) => ListBuilder
    /** Include the latest rows of a toMany relation, one extra query per page. */
    readonly include: (spec: IncludeSpec) => ListBuilder
    /** Narrow the rows; a second call is and-ed with the first. */
    readonly where: (expr: FilterExpr) => ListBuilder
    /** The order, ending with the entity key. */
    readonly order: (...keys: OrderBy) => ListBuilder
    /** Ends the builder with the page: `size` rows after the opaque cursor. */
    readonly page: (size: number, after?: string) => Query
}

interface ListDraft {
    readonly from: string
    readonly select: ReadonlyArray<string>
    readonly join: Readonly<Record<string, ReadonlyArray<string>>>
    readonly include: ReadonlyArray<IncludeSpec>
    readonly where: FilterExpr | undefined
    readonly order: OrderBy
}

const allOf = (...parts: ReadonlyArray<FilterExpr | undefined>): FilterExpr | undefined => {
    const present = parts.flatMap((part) => (part === undefined ? [] : [part]))
    return present.length <= 1 ? present[0] : { op: "and", of: present }
}

const builderOf = (draft: ListDraft): ListBuilder => ({
    select: (...fields) => builderOf({ ...draft, select: [...draft.select, ...fields] }),
    join: (relation, ...fields) => builderOf({ ...draft, join: { ...draft.join, [relation]: fields } }),
    include: (spec) => builderOf({ ...draft, include: [...draft.include, spec] }),
    where: (expr) => builderOf({ ...draft, where: allOf(draft.where, expr) }),
    order: (...keys) => builderOf({ ...draft, order: [...draft.order, ...keys] }),
    page: (size, after) => ({
        from: draft.from,
        select: draft.select,
        ...(Object.keys(draft.join).length > 0 ? { join: draft.join } : {}),
        ...(draft.include.length > 0 ? { include: draft.include } : {}),
        ...(draft.where === undefined ? {} : { where: draft.where }),
        order: draft.order,
        page: after === undefined ? { size } : { size, after },
    }),
})

/** An entity, as far as the DSL needs it: its name. */
export interface NamedEntity {
    /** The entity name. */
    readonly name: string
}

/** Builds a comparison of a field with a literal. */
export type CompareBuilder = (field: string, value: Scalar) => FilterExpr

/** Builds a comparison of a field with another field of the same row. */
export type CompareRefBuilder = (field: string, ref: string) => FilterExpr

/** The typed DSL that builds query trees: data, never SQL text. */
export interface QueryDsl {
    /** Equal to a literal. */
    readonly eq: CompareBuilder
    /** Not equal to a literal. */
    readonly ne: CompareBuilder
    /** Less than a literal. */
    readonly lt: CompareBuilder
    /** Less than or equal to a literal. */
    readonly lte: CompareBuilder
    /** Greater than a literal. */
    readonly gt: CompareBuilder
    /** Greater than or equal to a literal. */
    readonly gte: CompareBuilder
    /** Equal to another field of the same row. */
    readonly eqRef: CompareRefBuilder
    /** Not equal to another field of the same row. */
    readonly neRef: CompareRefBuilder
    /** Less than another field of the same row. */
    readonly ltRef: CompareRefBuilder
    /** Less than or equal to another field of the same row. */
    readonly lteRef: CompareRefBuilder
    /** Greater than another field of the same row. */
    readonly gtRef: CompareRefBuilder
    /** Greater than or equal to another field of the same row. */
    readonly gteRef: CompareRefBuilder
    /** One of the values. */
    readonly in: (field: string, values: ReadonlyArray<Scalar>) => FilterExpr
    /** None of the values. */
    readonly notIn: (field: string, values: ReadonlyArray<Scalar>) => FilterExpr
    /** The field is null. */
    readonly isNull: (field: string) => FilterExpr
    /** The field is not null. */
    readonly notNull: (field: string) => FilterExpr
    /** Accent- and case-insensitive substring match on text fields. */
    readonly search: (fields: ReadonlyArray<string>, text: string) => FilterExpr
    /** The two timestamp fields overlap the window. */
    readonly overlaps: (range: readonly [string, string], from: string, to: string) => FilterExpr
    /** All of the expressions. */
    readonly and: (...of: ReadonlyArray<FilterExpr>) => FilterExpr
    /** Any of the expressions. */
    readonly or: (...of: ReadonlyArray<FilterExpr>) => FilterExpr
    /** Not the expression. */
    readonly not: (of: FilterExpr) => FilterExpr
    /** A linked record of a toMany relation matches. */
    readonly has: (relation: string, where?: FilterExpr) => FilterExpr
    /** And of the parts that are present: nothing for none, the part itself for one. */
    readonly allOf: (...parts: ReadonlyArray<FilterExpr | undefined>) => FilterExpr | undefined
    /** Starts a list query over an entity. */
    readonly list: (entity: NamedEntity) => ListBuilder
}

/** The typed DSL that builds query trees: data, never SQL text. */
export const q: QueryDsl = {
    eq: compare("eq"),
    ne: compare("ne"),
    lt: compare("lt"),
    lte: compare("lte"),
    gt: compare("gt"),
    gte: compare("gte"),
    eqRef: compareRef("eq"),
    neRef: compareRef("ne"),
    ltRef: compareRef("lt"),
    lteRef: compareRef("lte"),
    gtRef: compareRef("gt"),
    gteRef: compareRef("gte"),
    in: (field: string, values: ReadonlyArray<Scalar>): FilterExpr => ({ op: "in", field, values }),
    notIn: (field: string, values: ReadonlyArray<Scalar>): FilterExpr => ({ op: "notIn", field, values }),
    isNull: (field: string): FilterExpr => ({ op: "isNull", field }),
    notNull: (field: string): FilterExpr => ({ op: "notNull", field }),
    search: (fields: ReadonlyArray<string>, text: string): FilterExpr => ({ op: "search", fields, text }),
    overlaps: (range: readonly [string, string], from: string, to: string): FilterExpr => ({
        op: "overlaps",
        range,
        from,
        to,
    }),
    and: (...of: ReadonlyArray<FilterExpr>): FilterExpr => ({ op: "and", of }),
    or: (...of: ReadonlyArray<FilterExpr>): FilterExpr => ({ op: "or", of }),
    not: (of: FilterExpr): FilterExpr => ({ op: "not", of }),
    has: (relation: string, where?: FilterExpr): FilterExpr =>
        where === undefined ? { op: "has", relation } : { op: "has", relation, where },
    allOf,
    list: (entity): ListBuilder =>
        builderOf({ from: entity.name, select: [], join: {}, include: [], where: undefined, order: [] }),
}
