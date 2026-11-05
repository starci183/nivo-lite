import type { EntityDefinition, FieldKind } from "../entity/entity.types"
import type { FilterCase, FilterOp, ListFilter, ListQuery, ListShape } from "./list-shape.mirror.types"
import { ownEntry } from "./own"
import { q } from "./q"
import { QueryBuildError } from "./query-error"
import { QUERY_BOUNDS } from "./query-bounds"
import type { Aggregate, FilterExpr, MeasureSpec, OrderBy, Query, Scalar } from "./query.types"

/** What a caller may add to the list query beyond the row fields of the shape. */
export interface ListQueryOptions {
    /** Further fields to select (the fields a detail or an include needs). */
    readonly select?: ReadonlyArray<string>
}

type Entity = Pick<EntityDefinition, "fields" | "name">

/** Every record is keyed and ordered by its id. */
const KEY = "id"

/** Reads a chosen filter value as a literal of one type. */
type ValueReader = (field: string, text: string) => Scalar

const textValue: ValueReader = (_field, text) => text

const numberValue: ValueReader = (field, text) => {
    const value = Number(text)
    if (!Number.isFinite(value)) {
        throw new QueryBuildError("LIST_FILTER_VALUE_UNKNOWN", `${field}=${text}`)
    }
    return value
}

const boolValue: ValueReader = (field, text) => {
    if (text !== "true" && text !== "false") {
        throw new QueryBuildError("LIST_FILTER_VALUE_UNKNOWN", `${field}=${text}`)
    }
    return text === "true"
}

const READERS: Readonly<Partial<Record<FieldKind, ValueReader>>> = {
    int: numberValue,
    money_vnd: numberValue,
    bool: boolValue,
}

/** The literal a chosen filter value stands for, typed by the field it compares (a list query carries filter values as text). */
const scalarOf = (entity: Entity, field: string, text: string): Scalar => {
    const kind = ownEntry(entity.fields, field)?.kind
    const reader = (kind === undefined ? undefined : READERS[kind]) ?? textValue
    return reader(field, text)
}

type CaseOp = Exclude<FilterOp, "in">

const COMPARE: Readonly<Record<CaseOp, (field: string, value: Scalar) => FilterExpr>> = {
    eq: q.eq,
    lt: q.lt,
    lte: q.lte,
    gt: q.gt,
    gte: q.gte,
}
const COMPARE_REF: Readonly<Record<CaseOp, (field: string, ref: string) => FilterExpr>> = {
    eq: q.eqRef,
    lt: q.ltRef,
    lte: q.lteRef,
    gt: q.gtRef,
    gte: q.gteRef,
}

/** One named case of a `cases` filter as an expression. */
const caseExpr = (name: string, filterCase: FilterCase): FilterExpr => {
    const { field, op, value, ref } = filterCase
    if (ref !== undefined) {
        if (op === "in") {
            throw new QueryBuildError("LIST_FILTER_CASE_INVALID", name)
        }
        return COMPARE_REF[op](field, ref)
    }
    if (value === undefined) {
        throw new QueryBuildError("LIST_FILTER_CASE_INVALID", name)
    }
    if (value === null) {
        if (op !== "eq") {
            throw new QueryBuildError("LIST_FILTER_CASE_INVALID", name)
        }
        return q.isNull(field)
    }
    return op === "in" ? q.in(field, [value]) : COMPARE[op](field, value)
}

/** The expression of one filter under the value the query chose. */
const filterExpr = (entity: Entity, name: string, filter: ListFilter, chosen: string): FilterExpr => {
    if ("cases" in filter) {
        const filterCase = ownEntry(filter.cases, chosen)
        if (filterCase === undefined) {
            throw new QueryBuildError("LIST_FILTER_VALUE_UNKNOWN", `${name}=${chosen}`)
        }
        return caseExpr(`${name}=${chosen}`, filterCase)
    }
    if (!filter.of.includes(chosen)) {
        throw new QueryBuildError("LIST_FILTER_VALUE_UNKNOWN", `${name}=${chosen}`)
    }
    const value = scalarOf(entity, filter.field, chosen)
    return filter.op === "eq" ? q.eq(filter.field, value) : q.in(filter.field, [value])
}

const filterOf = (shape: ListShape, name: string): ListFilter => {
    const filter = ownEntry(shape.filters ?? {}, name)
    if (filter === undefined) {
        throw new QueryBuildError("LIST_FILTER_UNKNOWN", name)
    }
    return filter
}

/** The where of a list query: the search and every chosen filter except the one named `skip`. */
const whereOf = (entity: Entity, shape: ListShape, query: ListQuery, skip: string | null): FilterExpr | undefined => {
    const text = (query.q ?? "").trim().slice(0, QUERY_BOUNDS.searchText)
    const search = shape.search !== undefined && text !== "" ? q.search(shape.search.fields, text) : undefined
    const filters = Object.entries(query.filters)
        .filter(([name]) => name !== skip)
        .map(([name, chosen]) => filterExpr(entity, name, filterOf(shape, name), chosen))
    return q.allOf(search, ...filters)
}

/** The chosen sort made total: it ends with the entity key, the way keyset paging needs. */
const totalOrder = (shape: ListShape, sort: string): OrderBy => {
    const order = ownEntry(shape.sort, sort)
    if (order === undefined) {
        throw new QueryBuildError("LIST_SORT_UNKNOWN", sort)
    }
    const last = order.at(-1)
    const tail: OrderBy = [[KEY, last?.[1] ?? "asc"]]
    return last?.[0] === KEY ? order : [...order, ...tail]
}

/**
 * The query tree of one page of a list read: the shape's row fields, the search and chosen filters as the where, the chosen sort made
 * total, the page and cursor. The same tree on the fe fixture port and in the back end. Throws `QueryBuildError` for a sort, filter
 * or filter value the shape does not declare (the variables were parsed against it, so that is a bug).
 */
export const listQueryOf = (
    entity: Entity,
    shape: ListShape,
    query: ListQuery,
    options: ListQueryOptions = {},
): Query => {
    const order = totalOrder(shape, query.sort)
    const { id, title, description, badge } = shape.row
    const wanted = [
        KEY,
        id,
        title,
        ...(description === undefined ? [] : [description]),
        ...(badge === undefined ? [] : [badge]),
        ...order.map(([field]) => field),
        ...(options.select ?? []),
    ]
    const select = wanted.filter((field, index) => wanted.indexOf(field) === index)
    const where = whereOf(entity, shape, query, null)
    const size = Math.min(Math.max(query.size, 1), QUERY_BOUNDS.pageSize)
    return {
        from: entity.name,
        select,
        ...(where === undefined ? {} : { where }),
        order,
        page: query.cursor === null ? { size } : { size, after: query.cursor },
    }
}

/**
 * The aggregate that counts rows per value of the filter `by`: the same search and filters as the list minus `by` itself, one
 * statement. An `of` filter groups by its field; a `cases` filter has one filtered count per case (a measure named after the case),
 * the cases being predicates and not values of a field.
 */
export const countsOf = (entity: Entity, shape: ListShape, by: string, query: ListQuery): Aggregate => {
    const filter = filterOf(shape, by)
    const where = whereOf(entity, shape, query, by)
    const base = { from: entity.name, ...(where === undefined ? {} : { where }) }
    if ("cases" in filter) {
        const measures = Object.entries(filter.cases).map(([name, filterCase]): [string, MeasureSpec] => [
            name,
            { kind: "count", where: caseExpr(`${by}=${name}`, filterCase) },
        ])
        return { ...base, measures: Object.fromEntries(measures), limit: 1 }
    }
    return { ...base, groupBy: [filter.field], measures: { count: { kind: "count" } }, limit: QUERY_BOUNDS.groups }
}
