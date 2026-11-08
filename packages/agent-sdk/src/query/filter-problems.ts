import type { EntityDefinition, FieldKind } from "../entity/entity.types"
import { kindClassOf, ORDERED_CLASSES, resolveField, type KindClass, type ResolvedField } from "./field-resolve"
import { ownEntry } from "./own"
import { QUERY_BOUNDS, QUERY_LIMITS } from "./query-bounds"
import type { FilterExpr, QueryProblem, Scalar } from "./query.types"

/** The entities a tree may name, by entity name. */
export type EntityCatalog = ReadonlyMap<string, EntityDefinition>

const BIGINT_TEXT = /^-?\d{1,19}$/

/** A problem of a tree at a path. */
export const problem = (code: QueryProblem["code"], at: string): QueryProblem => ({ code, at })

/** Whether a non-null literal can be compared with a field of this kind. */
const literalFits = (kind: FieldKind, value: Scalar): boolean => {
    const family = kindClassOf(kind)
    if (family === "number") {
        return typeof value === "number" || (kind === "bigint" && typeof value === "string" && BIGINT_TEXT.test(value))
    }
    if (family === "bool") {
        return typeof value === "boolean"
    }
    return family !== "json" && typeof value === "string"
}

/** A field named in a filter, or the problems that say why it does not resolve. */
interface FieldLookup {
    /** The resolved field, null when it does not resolve. */
    readonly field: ResolvedField | null
    /** Why it does not resolve. */
    readonly problems: ReadonlyArray<QueryProblem>
}

/** The target of a relation, or the problems that say why there is none. */
export interface RelationLookup {
    /** The target entity, null when there is none. */
    readonly target: EntityDefinition | null
    /** Why there is none. */
    readonly problems: ReadonlyArray<QueryProblem>
}

/** The problems of one field named in a filter (unknown, owner, undeclared custom key). */
const fieldOf = (entity: EntityDefinition, name: string, at: string): FieldLookup => {
    const resolved = resolveField(entity, name, "where")
    return resolved.ok
        ? { field: resolved.field, problems: [] }
        : { field: null, problems: [problem(resolved.code, at)] }
}

const valueProblems = (
    field: ResolvedField,
    op: string,
    value: Scalar | undefined,
    at: string,
): ReadonlyArray<QueryProblem> => {
    if (value === undefined) {
        return []
    }
    if (value === null) {
        return (op === "eq" || op === "ne") && field.nullable ? [] : [problem("QUERY_OP_INVALID", at)]
    }
    return literalFits(field.kind, value) ? [] : [problem("QUERY_OP_INVALID", at)]
}

/** The problems of the field a comparison names as its other side: it must exist and be of the same family. */
const refProblems = (
    entity: EntityDefinition,
    ref: string | undefined,
    family: KindClass,
    at: string,
): ReadonlyArray<QueryProblem> => {
    if (ref === undefined) {
        return []
    }
    const { field, problems } = fieldOf(entity, ref, at)
    return field !== null && kindClassOf(field.kind) !== family
        ? [...problems, problem("QUERY_OP_INVALID", at)]
        : problems
}

type CompareExpr = Extract<FilterExpr, { readonly op: "eq" | "ne" | "lt" | "lte" | "gt" | "gte" }>

const compareProblems = (entity: EntityDefinition, expr: CompareExpr, at: string): ReadonlyArray<QueryProblem> => {
    const { field, problems } = fieldOf(entity, expr.field, `${at}.field`)
    if (field === null) {
        return problems
    }
    const family = kindClassOf(field.kind)
    const ordering = expr.op !== "eq" && expr.op !== "ne"
    return [
        ...(family === "json" || (ordering && !ORDERED_CLASSES.has(family))
            ? [problem("QUERY_OP_INVALID", `${at}.op`)]
            : []),
        ...((expr.value === undefined) === (expr.ref === undefined) ? [problem("QUERY_OP_INVALID", at)] : []),
        ...refProblems(entity, expr.ref, family, `${at}.ref`),
        ...valueProblems(field, expr.op, expr.value, `${at}.value`),
    ]
}

/** The target entity of a relation of the wanted kind, or the problem that says why there is none. */
export const relationTarget = (
    entity: EntityDefinition,
    catalog: EntityCatalog,
    name: string,
    kind: "toOne" | "toMany",
    at: string,
): RelationLookup => {
    const relation = ownEntry(entity.relations ?? {}, name)
    if (relation === undefined) {
        return { target: null, problems: [problem("QUERY_RELATION_UNKNOWN", at)] }
    }
    if (relation.kind !== kind) {
        return { target: null, problems: [problem("QUERY_OP_INVALID", at)] }
    }
    const target = catalog.get(relation.target)
    return target === undefined
        ? { target: null, problems: [problem("QUERY_ENTITY_UNKNOWN", at)] }
        : { target, problems: [] }
}

const membershipProblems = (
    entity: EntityDefinition,
    expr: Extract<FilterExpr, { readonly op: "in" | "notIn" }>,
    at: string,
): ReadonlyArray<QueryProblem> => {
    const { field, problems } = fieldOf(entity, expr.field, `${at}.field`)
    return [
        ...problems,
        ...(field !== null && kindClassOf(field.kind) === "json" ? [problem("QUERY_OP_INVALID", `${at}.field`)] : []),
        ...(expr.values.length > QUERY_BOUNDS.inValues ? [problem("QUERY_BOUND_EXCEEDED", `${at}.values`)] : []),
        ...(field !== null && expr.values.some((value) => value === null || !literalFits(field.kind, value))
            ? [problem("QUERY_OP_INVALID", `${at}.values`)]
            : []),
    ]
}

/** The problems of the fields a search or overlap names: each must resolve and be of the one kind they need. */
const kindedFieldsProblems = (
    entity: EntityDefinition,
    names: ReadonlyArray<string>,
    kind: FieldKind,
    at: string,
): ReadonlyArray<QueryProblem> =>
    names.flatMap((name, index) => {
        const { field, problems } = fieldOf(entity, name, `${at}[${index}]`)
        return [
            ...problems,
            ...(field !== null && field.kind !== kind ? [problem("QUERY_OP_INVALID", `${at}[${index}]`)] : []),
        ]
    })

const searchProblems = (
    entity: EntityDefinition,
    expr: Extract<FilterExpr, { readonly op: "search" }>,
    at: string,
): ReadonlyArray<QueryProblem> => [
    ...(expr.fields.length === 0 ? [problem("QUERY_OP_INVALID", `${at}.fields`)] : []),
    ...(expr.fields.length > QUERY_LIMITS.searchFields || expr.text.length > QUERY_BOUNDS.searchText
        ? [problem("QUERY_BOUND_EXCEEDED", at)]
        : []),
    ...kindedFieldsProblems(entity, expr.fields, "text", `${at}.fields`),
]

const groupProblems = (
    entity: EntityDefinition,
    catalog: EntityCatalog,
    expr: Extract<FilterExpr, { readonly op: "and" | "or" }>,
    at: string,
    depth: number,
): ReadonlyArray<QueryProblem> => [
    ...(expr.of.length === 0 ? [problem("QUERY_OP_INVALID", `${at}.of`)] : []),
    ...(expr.of.length > QUERY_BOUNDS.width ? [problem("QUERY_BOUND_EXCEEDED", `${at}.of`)] : []),
    ...expr.of.flatMap((child, index) => filterProblems(entity, catalog, child, `${at}.of[${index}]`, depth + 1)),
]

const hasProblems = (
    entity: EntityDefinition,
    catalog: EntityCatalog,
    expr: Extract<FilterExpr, { readonly op: "has" }>,
    at: string,
    depth: number,
): ReadonlyArray<QueryProblem> => {
    const { target, problems } = relationTarget(entity, catalog, expr.relation, "toMany", `${at}.relation`)
    return target === null || expr.where === undefined
        ? problems
        : filterProblems(target, catalog, expr.where, `${at}.where`, depth + 1)
}

/** The problems of a filter expression against an entity: unknown names, op and type mismatches, bounds, the owner field. */
export function filterProblems(
    entity: EntityDefinition,
    catalog: EntityCatalog,
    expr: FilterExpr,
    at: string,
    depth: number,
): ReadonlyArray<QueryProblem> {
    if (depth > QUERY_BOUNDS.depth) {
        return [problem("QUERY_BOUND_EXCEEDED", at)]
    }
    switch (expr.op) {
        case "eq":
        case "ne":
        case "lt":
        case "lte":
        case "gt":
        case "gte":
            return compareProblems(entity, expr, at)
        case "in":
        case "notIn":
            return membershipProblems(entity, expr, at)
        case "isNull":
        case "notNull":
            return fieldOf(entity, expr.field, `${at}.field`).problems
        case "search":
            return searchProblems(entity, expr, at)
        case "overlaps":
            return kindedFieldsProblems(entity, expr.range, "timestamptz", `${at}.range`)
        case "and":
        case "or":
            return groupProblems(entity, catalog, expr, at, depth)
        case "not":
            return filterProblems(entity, catalog, expr.of, `${at}.of`, depth + 1)
        case "has":
            return hasProblems(entity, catalog, expr, at, depth)
    }
}
