import type { CustomKeyKind, EntityDefinition, FieldDef, FieldKind } from "./entity.types"
import type { FilterExpr, Scalar } from "../query/query.types"
import { EntityRenderError } from "./render-error"

const IDENT = /^[a-z_][a-z0-9_]{0,62}$/
const KEY = /^[A-Za-z]\w{0,59}$/

/** The record columns every entity has, by system field name. */
const SYSTEM_COLUMNS: Readonly<Record<string, string>> = {
    id: "id",
    workspaceId: "workspace_id",
    version: "version",
    createdAt: "created_at",
    updatedAt: "updated_at",
}

/** A double-quoted identifier; only names of the generated shape (lower case, digits, underscore, at most 63) are written. */
export const quoteIdent = (name: string): string => {
    if (!IDENT.test(name)) throw new EntityRenderError("ENTITY_RENDER_NAME_INVALID", name)
    return `"${name}"`
}

/** A single-quoted literal with quotes doubled; control characters (NUL included) are refused. */
export const quoteLiteral = (value: string): string => {
    if (/\p{Cc}/u.test(value)) throw new EntityRenderError("ENTITY_RENDER_VALUE_INVALID", "control character")
    return `'${value.replaceAll("'", "''")}'`
}

/** A data key (a declared field or nested key name), refused unless it is a plain word. */
export const dataKey = (name: string): string => {
    if (!KEY.test(name)) throw new EntityRenderError("ENTITY_RENDER_NAME_INVALID", name)
    return name
}

/** The cast (with its `::`) that keeps an expression indexable and typed, or "" for the kinds that stay text. */
const CAST: Readonly<Record<FieldKind, string>> = {
    uuid: "::uuid",
    text: "",
    int: "::integer",
    bigint: "::bigint",
    bool: "::boolean",
    timestamptz: "",
    date: "",
    jsonb: "",
    enum: "",
    money_vnd: "::bigint",
    sequence: "",
}

/** The text of a data key: `(data->>'name')`. */
export const textOf = (name: string): string => `(data->>${quoteLiteral(dataKey(name))})`

/** The jsonb of a data key: `(data->'name')`. */
export const jsonOf = (name: string): string => `(data->${quoteLiteral(dataKey(name))})`

/** The typed expression of a field or system field; time kinds stay ISO text (their cast is not immutable). */
export const exprOf = (entity: EntityDefinition, name: string): string => {
    const system = SYSTEM_COLUMNS[name]
    if (system !== undefined) return system
    const field: FieldDef | undefined = entity.fields[name]
    if (field === undefined) throw new EntityRenderError("ENTITY_RENDER_NAME_INVALID", name)
    if (field.kind === "jsonb") return jsonOf(name)
    const cast = CAST[field.kind]
    return cast === "" ? textOf(name) : `(${textOf(name)}${cast})`
}

/** The typed expression of a nested key of a jsonb field. */
export const keyExprOf = (field: string, key: string, kind: CustomKeyKind): string => {
    const raw = `(data->${quoteLiteral(dataKey(field))}->>${quoteLiteral(dataKey(key))})`
    const cast = CAST[kind]
    return cast === "" ? raw : `(${raw}${cast})`
}

const scalar = (value: Scalar | undefined): string => {
    if (value === undefined || value === null) return "NULL"
    if (typeof value === "string") return quoteLiteral(value)
    if (typeof value === "number") {
        if (!Number.isFinite(value)) throw new EntityRenderError("ENTITY_RENDER_VALUE_INVALID", String(value))
        return String(value)
    }
    return value ? "TRUE" : "FALSE"
}

const COMPARE: Readonly<Record<string, string>> = { eq: "=", ne: "<>", lt: "<", lte: "<=", gt: ">", gte: ">=" }

/** Escape the LIKE metacharacters of a search text. */
const likeEscape = (text: string): string => text.replaceAll(/[\\%_]/g, (char) => `\\${char}`)

type CompareFilter = Extract<FilterExpr, { readonly op: "eq" | "ne" | "lt" | "lte" | "gt" | "gte" }>
type ListFilter = Extract<FilterExpr, { readonly op: "in" | "notIn" }>
type SearchFilter = Extract<FilterExpr, { readonly op: "search" }>
type GroupFilter = Extract<FilterExpr, { readonly op: "and" | "or" }>

const compareSql = (entity: EntityDefinition, filter: CompareFilter): string => {
    const left = exprOf(entity, filter.field)
    if (filter.ref !== undefined) return `${left} ${COMPARE[filter.op]} ${exprOf(entity, filter.ref)}`
    if (filter.value === null && (filter.op === "eq" || filter.op === "ne")) {
        return `${left} IS ${filter.op === "eq" ? "" : "NOT "}NULL`
    }
    return `${left} ${COMPARE[filter.op]} ${scalar(filter.value)}`
}

const listSql = (entity: EntityDefinition, filter: ListFilter): string => {
    if (filter.values.length === 0 || filter.values.length > 500) {
        throw new EntityRenderError("ENTITY_RENDER_VALUE_INVALID", "in-list size")
    }
    const word = filter.op === "in" ? "IN" : "NOT IN"
    return `${exprOf(entity, filter.field)} ${word} (${filter.values.map((value) => scalar(value)).join(", ")})`
}

const searchSql = (filter: SearchFilter): string => {
    if (filter.fields.length === 0 || filter.text.length > 200) {
        throw new EntityRenderError("ENTITY_RENDER_VALUE_INVALID", "search")
    }
    const pattern = quoteLiteral(`%${likeEscape(filter.text)}%`)
    const matches = filter.fields.map(
        (field) => `public.knowledge_fold(${textOf(field)}) LIKE public.knowledge_fold(${pattern})`,
    )
    return `(${matches.join(" OR ")})`
}

const groupSql = (entity: EntityDefinition, filter: GroupFilter): string => {
    if (filter.of.length === 0 || filter.of.length > 32) {
        throw new EntityRenderError("ENTITY_RENDER_VALUE_INVALID", "and/or width")
    }
    const parts = filter.of.map((part) => filterSql(entity, part))
    return `(${parts.join(filter.op === "and" ? " AND " : " OR ")})`
}

const overlapsSql = (filter: Extract<FilterExpr, { readonly op: "overlaps" }>): string => {
    const own = `tstzrange(public.engine_ts(${textOf(filter.range[0])}), public.engine_ts(${textOf(filter.range[1])}))`
    return `${own} && tstzrange(${quoteLiteral(filter.from)}::timestamptz, ${quoteLiteral(filter.to)}::timestamptz)`
}

/** A filter as a SQL predicate over the record row; the engine-only `has` is refused (a DDL predicate sees one row). */
export const filterSql = (entity: EntityDefinition, filter: FilterExpr): string => {
    switch (filter.op) {
        case "eq":
        case "ne":
        case "lt":
        case "lte":
        case "gt":
        case "gte":
            return compareSql(entity, filter)
        case "in":
        case "notIn":
            return listSql(entity, filter)
        case "isNull":
            return `${exprOf(entity, filter.field)} IS NULL`
        case "notNull":
            return `${exprOf(entity, filter.field)} IS NOT NULL`
        case "search":
            return searchSql(filter)
        case "overlaps":
            return overlapsSql(filter)
        case "and":
        case "or":
            return groupSql(entity, filter)
        case "not":
            return `(NOT ${filterSql(entity, filter.of)})`
        case "has":
            throw new EntityRenderError("ENTITY_RENDER_OP_UNSUPPORTED", "has")
    }
}
