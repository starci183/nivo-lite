import type { ConstraintDef, EntityDefinition, IndexDef, IndexPart } from "../entity/entity.types"
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

/**
 * Whether the rows a read pins all satisfy a partial index's predicate: only a `notNull` of a field the read pins by equality to a
 * value (an equality to a literal is never null), so the partial index holds every row the read can find.
 */
export const predicateHolds = (predicate: FilterExpr | undefined, equality: ReadonlyArray<string>): boolean =>
    predicate === undefined || (predicate.op === "notNull" && equality.includes(predicate.field))

/** Whether an index serves (equality fields in any order, then the order) as a prefix of its parts, after the implicit workspace. */
const servesPrefix = (index: IndexDef, equality: ReadonlyArray<string>, order: OrderBy): boolean => {
    if (!predicateHolds(index.where, equality) || (index.using !== undefined && index.using !== "btree")) {
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
 * The index behind a declared unique constraint: its fields, then the id, with the constraint's predicate when it is partial (it then
 * serves only a read whose pins make the predicate hold, see `predicateHolds`).
 */
const uniqueIndexOf = (constraint: ConstraintDef): IndexDef | null =>
    constraint.kind === "unique"
        ? {
              name: constraint.name,
              on: [...constraint.on, "id"],
              ...(constraint.where === undefined ? {} : { where: constraint.where }),
          }
        : null

/** The indexes an entity is served by: the declared ones, and the unique index behind each unconditional unique constraint. */
const servingIndexesOf = (entity: EntityDefinition): ReadonlyArray<IndexDef> => [
    ...(entity.indexes ?? []),
    ...(entity.constraints ?? []).flatMap((constraint) => uniqueIndexOf(constraint) ?? []),
]

/**
 * Whether a list query is served by a declared index or by the unique index behind a declared unique constraint: (workspace, the equality-filter fields, the order fields) must be a prefix of
 * the `on` of one declared btree index, the workspace leading every index implicitly (plan 2.11, 11). A field both pinned and
 * ordered counts once, as pinned.
 */
export const isIndexed = (entity: EntityDefinition, where: FilterExpr | undefined, order: OrderBy): boolean => {
    const equality = [...new Set(equalityFieldsOf(where))]
    const rest = order.filter(([field]) => !equality.includes(field))
    return servingIndexesOf(entity).some((index) => servesPrefix(index, equality, rest))
}
