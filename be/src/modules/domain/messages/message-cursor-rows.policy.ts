import type { OptionalCursorInstant, OptionalMessageCursor } from "./message-cursors.contracts"

/** A message position read from the first raw row of a cursor query: its id and creation instant, or none when the row is not one. */
export const cursorOfRows = (rows: ReadonlyArray<unknown>): OptionalMessageCursor => {
    const [row] = rows
    if (typeof row !== "object" || row === null) return null
    const id: unknown = Reflect.get(row, "id")
    const createdAt: unknown = Reflect.get(row, "createdAt")
    return typeof id === "string" && typeof createdAt === "string" ? { id, createdAt } : null
}

/** The first creation instant, as the database words it, among raw rows of a cursor query; none when no row carries one. */
export const createdAtOfRows = (rows: ReadonlyArray<unknown>): OptionalCursorInstant => {
    const created = rows.map((row): unknown =>
        typeof row === "object" && row !== null ? Reflect.get(row, "createdAt") : null,
    )
    return created.find((value): value is string => typeof value === "string") ?? null
}
