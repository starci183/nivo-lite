import type { EntityDefinition } from "../entity/entity.types"
import { kindClassOf, ORDERED_CLASSES, resolveField, type FieldUse } from "./field-resolve"
import { filterProblems, problem, relationTarget, type EntityCatalog } from "./filter-problems"
import { isIndexed } from "./index-prefix"
import { QUERY_BOUNDS, QUERY_LIMITS } from "./query-bounds"
import type { Aggregate, IncludeSpec, MeasureSpec, OrderBy, Query, QueryProblem } from "./query.types"

/** The problems of the fields a tree names: unknown, the owner field, an undeclared custom key, a whole jsonb where a scalar is needed. */
const fieldsProblems = (
    entity: EntityDefinition,
    names: ReadonlyArray<string>,
    use: FieldUse,
    at: string,
    scalarOnly: boolean,
): ReadonlyArray<QueryProblem> =>
    names.flatMap((name, index) => {
        const resolved = resolveField(entity, name, use)
        if (!resolved.ok) {
            return [problem(resolved.code, `${at}[${index}]`)]
        }
        return scalarOnly && kindClassOf(resolved.field.kind) === "json"
            ? [problem("QUERY_OP_INVALID", `${at}[${index}]`)]
            : []
    })

/** The problems of an order: bounded, sortable fields, and ending with the entity key so the order is total. */
const orderProblems = (entity: EntityDefinition, order: OrderBy, at: string): ReadonlyArray<QueryProblem> => [
    ...(order.length > QUERY_LIMITS.order ? [problem("QUERY_BOUND_EXCEEDED", at)] : []),
    ...(order.at(-1)?.[0] === "id" ? [] : [problem("QUERY_ORDER_NOT_TOTAL", at)]),
    ...order.flatMap(([field], index) => {
        const resolved = resolveField(entity, field, "order")
        if (!resolved.ok) {
            return [problem(resolved.code, `${at}[${index}]`)]
        }
        return kindClassOf(resolved.field.kind) === "json" ? [problem("QUERY_OP_INVALID", `${at}[${index}]`)] : []
    }),
]

const selectProblems = (
    entity: EntityDefinition,
    select: ReadonlyArray<string>,
    at: string,
): ReadonlyArray<QueryProblem> => [
    ...(select.length > QUERY_LIMITS.select ? [problem("QUERY_BOUND_EXCEEDED", at)] : []),
    ...fieldsProblems(entity, select, "select", at, false),
]

const joinProblems = (
    entity: EntityDefinition,
    catalog: EntityCatalog,
    join: Query["join"],
): ReadonlyArray<QueryProblem> => {
    const entries = Object.entries(join ?? {})
    return [
        ...(entries.length > QUERY_LIMITS.join ? [problem("QUERY_BOUND_EXCEEDED", "join")] : []),
        ...entries.flatMap(([name, select]) => {
            const { target, problems } = relationTarget(entity, catalog, name, "toOne", `join.${name}`)
            return target === null ? problems : selectProblems(target, select, `join.${name}`)
        }),
    ]
}

const includeProblems = (
    entity: EntityDefinition,
    catalog: EntityCatalog,
    include: ReadonlyArray<IncludeSpec>,
): ReadonlyArray<QueryProblem> => [
    ...(include.length > QUERY_LIMITS.include ? [problem("QUERY_BOUND_EXCEEDED", "include")] : []),
    ...include.flatMap((spec, index) => {
        const at = `include[${index}]`
        const { target, problems } = relationTarget(entity, catalog, spec.relation, "toMany", `${at}.relation`)
        if (target === null) {
            return problems
        }
        return [
            ...selectProblems(target, spec.select, `${at}.select`),
            ...orderProblems(target, spec.order, `${at}.order`),
            ...(Number.isInteger(spec.latest) && spec.latest >= 1 && spec.latest <= QUERY_BOUNDS.includeLatest
                ? []
                : [problem("QUERY_BOUND_EXCEEDED", `${at}.latest`)]),
        ]
    }),
]

const listProblems = (tree: Query, catalog: EntityCatalog): ReadonlyArray<QueryProblem> => {
    const entity = catalog.get(tree.from)
    if (entity === undefined) {
        return [problem("QUERY_ENTITY_UNKNOWN", "from")]
    }
    const found = [
        ...selectProblems(entity, tree.select, "select"),
        ...joinProblems(entity, catalog, tree.join),
        ...includeProblems(entity, catalog, tree.include ?? []),
        ...(tree.where === undefined ? [] : filterProblems(entity, catalog, tree.where, "where", 1)),
        ...orderProblems(entity, tree.order, "order"),
        ...(Number.isInteger(tree.page.size) && tree.page.size >= 1 && tree.page.size <= QUERY_BOUNDS.pageSize
            ? []
            : [problem("QUERY_BOUND_EXCEEDED", "page.size")]),
    ]
    return found.length === 0 && !isIndexed(entity, tree.where, tree.order)
        ? [problem("QUERY_NOT_INDEXED", "order")]
        : found
}

const measureFieldProblems = (
    entity: EntityDefinition,
    name: string,
    measure: MeasureSpec,
): ReadonlyArray<QueryProblem> => {
    const at = `measures.${name}.field`
    if (measure.field === undefined) {
        return measure.kind === "count" ? [] : [problem("QUERY_OP_INVALID", at)]
    }
    const resolved = resolveField(entity, measure.field, "group")
    if (!resolved.ok) {
        return [problem(resolved.code, at)]
    }
    const family = kindClassOf(resolved.field.kind)
    const fits =
        measure.kind === "sum" || measure.kind === "avg"
            ? family === "number"
            : measure.kind === "count" || ORDERED_CLASSES.has(family)
    return fits ? [] : [problem("QUERY_OP_INVALID", at)]
}

const measureProblems = (
    entity: EntityDefinition,
    catalog: EntityCatalog,
    name: string,
    measure: MeasureSpec,
): ReadonlyArray<QueryProblem> => [
    ...measureFieldProblems(entity, name, measure),
    ...(measure.where === undefined ? [] : filterProblems(entity, catalog, measure.where, `measures.${name}.where`, 1)),
]

const bucketProblems = (entity: EntityDefinition, field: string): ReadonlyArray<QueryProblem> => {
    const resolved = resolveField(entity, field, "group")
    if (!resolved.ok) {
        return [problem(resolved.code, "bucket.field")]
    }
    const family = kindClassOf(resolved.field.kind)
    return family === "time" || family === "date" ? [] : [problem("QUERY_OP_INVALID", "bucket.field")]
}

const aggregateProblems = (tree: Aggregate, catalog: EntityCatalog): ReadonlyArray<QueryProblem> => {
    const entity = catalog.get(tree.from)
    if (entity === undefined) {
        return [problem("QUERY_ENTITY_UNKNOWN", "from")]
    }
    const groupBy = tree.groupBy ?? []
    const measures = Object.entries(tree.measures)
    return [
        ...(tree.where === undefined ? [] : filterProblems(entity, catalog, tree.where, "where", 1)),
        ...(groupBy.length > QUERY_BOUNDS.groupBy ? [problem("QUERY_BOUND_EXCEEDED", "groupBy")] : []),
        ...fieldsProblems(entity, groupBy, "group", "groupBy", true),
        ...(measures.length === 0 || measures.length > QUERY_LIMITS.measures
            ? [problem("QUERY_BOUND_EXCEEDED", "measures")]
            : []),
        ...measures.flatMap(([name, measure]) => measureProblems(entity, catalog, name, measure)),
        ...(tree.bucket === undefined ? [] : bucketProblems(entity, tree.bucket.field)),
        ...(Number.isInteger(tree.limit) && tree.limit >= 1 && tree.limit <= QUERY_BOUNDS.groups
            ? []
            : [problem("QUERY_BOUND_EXCEEDED", "limit")]),
    ]
}

/**
 * Everything wrong with a query or aggregate tree against the entity catalog, as stable codes with a path: unknown entity, field or
 * relation; an op that does not fit the field's kind; a bound exceeded; an order that does not end with the key; the workspace field
 * named anywhere; an undeclared custom key; a list query no declared index serves. Empty means the tree may run.
 */
export const queryProblems = (tree: Query | Aggregate, catalog: EntityCatalog): ReadonlyArray<QueryProblem> =>
    "measures" in tree ? aggregateProblems(tree, catalog) : listProblems(tree, catalog)
