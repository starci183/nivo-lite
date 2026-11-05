import type { EntityDefinition, IndexDef, IndexPart } from "../entity/entity.types"
import type { FilterExpr, OrderBy } from "./query.types"

interface IndexColumn {
    readonly name: string
    readonly desc: boolean
}

/** One index part as a column; a folded part is the fold of a field, never the field itself. */
const columnOf = (part: IndexPart): IndexColumn => {
    if (typeof part === "string") {
        return { name: part, desc: false }
    }
    if ("desc" in part) {
        return { name: part.desc, desc: true }
    }
    if ("fold" in part) {
        return { name: `fold:${part.fold}`, desc: false }
    }
    return { name: `${part.key[0]}.${part.key[1]}`, desc: false }
}

/** The fields a where pins to one value at its top level (an `eq` with a literal, alone or inside `and`s): the index equality prefix. */
export const equalityFieldsOf = (where: FilterExpr | undefined): ReadonlyArray<string> => {
    if (where === undefined) {
        return []
    }
    if (where.op === "and") {
        return where.of.flatMap((part) => equalityFieldsOf(part))
    }
    if (where.op !== "eq") {
        return []
    }
    return (where.value ?? undefined) === undefined ? [] : [where.field]
}

const columnIs = (column: IndexColumn | undefined, field: string, desc: boolean): boolean =>
    column?.name === field && column.desc === desc

/** Whether the order, read forward or backward, is the run of columns after the equality prefix. */
const orderMatches = (columns: ReadonlyArray<IndexColumn>, order: OrderBy): boolean =>
    order.every(([field, direction], index) => columnIs(columns[index], field, direction === "desc")) ||
    order.every(([field, direction], index) => columnIs(columns[index], field, direction === "asc"))

/** Whether an index serves (equality fields in any order, then the order) as a prefix of its parts, after the implicit workspace. */
const servesPrefix = (index: IndexDef, equality: ReadonlyArray<string>, order: OrderBy): boolean => {
    if (index.where !== undefined || (index.using !== undefined && index.using !== "btree")) {
        return false
    }
    const columns = index.on.map(columnOf)
    const pinned = columns.slice(0, equality.length).map((column) => column.name)
    return (
        pinned.length === equality.length &&
        equality.every((field) => pinned.includes(field)) &&
        orderMatches(columns.slice(equality.length), order)
    )
}

/**
 * Whether a list query is served by a declared index: (workspace, the equality-filter fields, the order fields) must be a prefix of
 * the `on` of one declared btree index, the workspace leading every index implicitly (plan 2.11, 11). A field both pinned and
 * ordered counts once, as pinned.
 */
export const isIndexed = (entity: EntityDefinition, where: FilterExpr | undefined, order: OrderBy): boolean => {
    const equality = [...new Set(equalityFieldsOf(where))]
    const rest = order.filter(([field]) => !equality.includes(field))
    return (entity.indexes ?? []).some((index) => servesPrefix(index, equality, rest))
}
