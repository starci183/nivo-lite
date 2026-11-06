import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { FilterExpr, OrderBy } from "@nivo-lite/agent-sdk/query"

/** The value of a field of a record: a system field, else a declared one. */
export const valueOf = (row: RecordRow, field: string): unknown => {
    if (field === "id" || field === "version" || field === "createdAt" || field === "updatedAt") return row[field]
    return row.data[field]
}

/** Whether a value is null or absent. */
export const isNil = (value: unknown): boolean => value === null || value === undefined

/** -1, 0 or 1 as the first value sorts before, with or after the second: numbers by size, anything else as text. */
export const signOf = (left: unknown, right: unknown): number => {
    if (typeof left === "number" && typeof right === "number") return Math.sign(left - right)
    const [a, b] = [String(left), String(right)]
    if (a === b) return 0
    return a < b ? -1 : 1
}

/** Whether a record matches a condition; the fake knows the operators the module writes, and a condition of any other operator matches nothing. */
export const matches = (row: RecordRow, where: FilterExpr | undefined): boolean => {
    if (where === undefined) return true
    if (where.op === "and") return where.of.every((part) => matches(row, part))
    if (where.op === "in") return new Set<unknown>(where.values).has(valueOf(row, where.field))
    if (where.op === "gte") return signOf(valueOf(row, where.field), where.value) >= 0
    if (where.op === "notNull") return !isNil(valueOf(row, where.field))
    if (where.op === "lt") return signOf(valueOf(row, where.field), where.value) < 0
    return where.op === "eq" && valueOf(row, where.field) === where.value
}

/** The comparison of two records under an order. */
export const compareBy =
    (order: OrderBy) =>
    (a: RecordRow, b: RecordRow): number =>
        order.reduce(
            (decided, [field, direction]) =>
                decided !== 0 ? decided : signOf(valueOf(a, field), valueOf(b, field)) * (direction === "asc" ? 1 : -1),
            0,
        )

/** The fields of a record of data limited to the selected ones. */
export const pick = (data: Readonly<Record<string, unknown>>, select: ReadonlyArray<string>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(data).filter(([field]) => select.includes(field)))
