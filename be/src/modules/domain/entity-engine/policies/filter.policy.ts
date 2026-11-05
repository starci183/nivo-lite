import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type {
    CompareExpr,
    FilterExpr,
    MembershipExpr,
    OverlapsExpr,
    Scalar,
    SearchExpr,
} from "@nivo-lite/agent-sdk/query"
import type { ObjectLiteral, SelectQueryBuilder } from "typeorm"
import { RecordEntity, RecordLinkEntity } from "../persistence/entities"
import { entityOf, relationOf } from "./catalog-access.policy"
import type { EntityCatalog } from "./compiler.contracts"
import { fieldExpression } from "./field-access.policy"
import { likeContains } from "./like-operand.policy"
import type { ParamBag } from "./param-bag.policy"

/** What `has` needs of the statement's query builder: a sub-query builder that shares its parameters. */
export interface SubQueryHost {
    /** A fresh builder for a nested SELECT of the statement. */
    subQuery(): SelectQueryBuilder<ObjectLiteral>
}

/** What a filter is compiled against: the entity and the alias of its records, the statement's parameters and its builder. */
export interface FilterScope {
    /** The entities `has` follows relations into. */
    readonly catalog: EntityCatalog
    /** The entity the filtered records belong to. */
    readonly entity: EntityDefinition
    /** The alias of the filtered records in the statement. */
    readonly alias: string
    /** The parameters of the statement. */
    readonly params: ParamBag
    /** The statement's builder, which makes the sub-query of `has`. */
    readonly builder: SubQueryHost
    /** How many `has` levels enclose this filter; names the aliases of the next level. */
    readonly depth: number
}

/** The SQL operator of each comparison; `ne` is null-safe, so a missing value counts as different. */
const COMPARE_OPERATORS = {
    eq: "=",
    ne: "IS DISTINCT FROM",
    lt: "<",
    lte: "<=",
    gt: ">",
    gte: ">=",
} as const

const nullTest = (left: string, op: CompareExpr["op"]): string => {
    if (op === "eq") return `${left} IS NULL`
    if (op === "ne") return `${left} IS NOT NULL`
    return "FALSE"
}

const compare = (expr: CompareExpr, scope: FilterScope): string => {
    const left = fieldExpression(scope.entity, expr.field, scope.alias, scope.params)
    if (expr.ref !== undefined)
        return `${left} ${COMPARE_OPERATORS[expr.op]} ${fieldExpression(scope.entity, expr.ref, scope.alias, scope.params)}`
    if (expr.value === undefined || expr.value === null) return nullTest(left, expr.op)
    return `${left} ${COMPARE_OPERATORS[expr.op]} :${scope.params.bind(expr.value)}`
}

const present = (values: ReadonlyArray<Scalar>): Array<Exclude<Scalar, null>> =>
    values.filter((value): value is Exclude<Scalar, null> => value !== null)

/** The parts that exist, joined by `glue` in parentheses, or `none` when no part exists. */
const joined = (parts: ReadonlyArray<string | null>, glue: string, none: string): string => {
    const kept = parts.filter((part): part is string => part !== null)
    return kept.length === 0 ? none : `(${kept.join(glue)})`
}

const membership = (expr: MembershipExpr, scope: FilterScope): string => {
    const left = fieldExpression(scope.entity, expr.field, scope.alias, scope.params)
    const values = present(expr.values)
    const hasNull = values.length < expr.values.length
    const list = values.length === 0 ? null : `:...${scope.params.bind(values)}`
    if (expr.op === "in")
        return joined(
            [list === null ? null : `${left} IN (${list})`, hasNull ? `${left} IS NULL` : null],
            " OR ",
            "FALSE",
        )
    const notIn = list === null ? null : `${left} NOT IN (${list})`
    return joined(
        [notIn === null || hasNull ? notIn : `(${left} IS NULL OR ${notIn})`, hasNull ? `${left} IS NOT NULL` : null],
        " AND ",
        "TRUE",
    )
}

const search = (expr: SearchExpr, scope: FilterScope): string => {
    if (expr.fields.length === 0) return "FALSE"
    const operand = `public.knowledge_fold(:${scope.params.bind(likeContains(expr.text))})`
    const parts = expr.fields.map(
        (field) =>
            `public.knowledge_fold(${fieldExpression(scope.entity, field, scope.alias, scope.params)}) LIKE ${operand}`,
    )
    return `(${parts.join(" OR ")})`
}

const overlaps = (expr: OverlapsExpr, scope: FilterScope): string => {
    const [start, end] = expr.range
    const own = `tstzrange(${fieldExpression(scope.entity, start, scope.alias, scope.params)}, ${fieldExpression(scope.entity, end, scope.alias, scope.params)})`
    const window = `tstzrange(CAST(:${scope.params.bind(expr.from)} AS timestamptz), CAST(:${scope.params.bind(expr.to)} AS timestamptz))`
    return `${own} && ${window}`
}

const group = (op: "and" | "or", of: ReadonlyArray<FilterExpr>, scope: FilterScope): string => {
    if (of.length === 0) return op === "and" ? "TRUE" : "FALSE"
    return `(${of.map((part) => filterFragment(part, scope)).join(op === "and" ? " AND " : " OR ")})`
}

const has = (relationName: string, where: FilterExpr | undefined, scope: FilterScope): string => {
    const relation = relationOf(scope.entity, relationName)
    const target = entityOf(scope.catalog, relation.target)
    const link = `l${String(scope.depth)}`
    const linked = `t${String(scope.depth)}`
    const correlated = [
        `${link}.workspaceId = ${scope.alias}.workspaceId`,
        `${link}.fromEntity = :${scope.params.bind(scope.entity.name)}`,
        `${link}.fromId = ${scope.alias}.id`,
        `${link}.relation = :${scope.params.bind(relationName)}`,
        `${link}.toEntity = :${scope.params.bind(target.name)}`,
    ].join(" AND ")
    const base = scope.builder
        .subQuery()
        .select("1")
        .from(RecordLinkEntity, link)
        .innerJoin(
            RecordEntity,
            linked,
            `${linked}.entity = ${link}.toEntity AND ${linked}.id = ${link}.toId AND ${linked}.workspaceId = ${link}.workspaceId`,
        )
        .where(correlated)
    const narrowed =
        where === undefined
            ? base
            : base.andWhere(filterFragment(where, { ...scope, entity: target, alias: linked, depth: scope.depth + 1 }))
    return `EXISTS ${narrowed.getQuery()}`
}

/**
 * The boolean expression of a filter tree against the records aliased `scope.alias`. Values and field names are bound parameters of
 * `scope.params` (the caller applies them with `setParameters`); the text holds only fixed words of this file and parameter names.
 */
export const filterFragment = (expr: FilterExpr, scope: FilterScope): string => {
    switch (expr.op) {
        case "eq":
        case "ne":
        case "lt":
        case "lte":
        case "gt":
        case "gte":
            return compare(expr, scope)
        case "in":
        case "notIn":
            return membership(expr, scope)
        case "isNull":
            return `${fieldExpression(scope.entity, expr.field, scope.alias, scope.params)} IS NULL`
        case "notNull":
            return `${fieldExpression(scope.entity, expr.field, scope.alias, scope.params)} IS NOT NULL`
        case "search":
            return search(expr, scope)
        case "overlaps":
            return overlaps(expr, scope)
        case "and":
        case "or":
            return group(expr.op, expr.of, scope)
        case "not":
            return `NOT (${filterFragment(expr.of, scope)})`
        case "has":
            return has(expr.relation, expr.where, scope)
    }
}
