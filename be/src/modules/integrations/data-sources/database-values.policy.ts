import { DATABASE_COPY } from "./messages/database.messages"
import type { DatabaseRecord, DatabaseRow, DatabaseSelection } from "./database-session.contracts"

const MAX_TEXT = 4000
const PREVIEW_CELL = 80

/** The cursor column's alias in generated selects. */
export const DATABASE_CURSOR = "__nivo_cursor"

/** True for a plain object. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** A driver answer as rows; anything else is no rows. */
export const toRows = (value: unknown): ReadonlyArray<DatabaseRow> =>
    Array.isArray(value) ? value.filter(isRecord) : []

const cut = (text: string): string => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}...` : text)

/** A cell value in a form that is safe to store as JSON. */
export const plainValue = (value: unknown): unknown => {
    if (value === null || value === undefined) return null
    if (typeof value === "bigint") return value.toString()
    if (typeof value === "number") return Number.isFinite(value) ? value : String(value)
    if (typeof value === "boolean") return value
    if (typeof value === "string") return cut(value)
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
    if (value instanceof Uint8Array) return DATABASE_COPY.binary(value.byteLength)
    const text = JSON.stringify(value, (_key, inner: unknown) => (typeof inner === "bigint" ? inner.toString() : inner))
    if (typeof text !== "string") return null
    if (text.length > MAX_TEXT) return `${text.slice(0, MAX_TEXT)}...`
    return value
}

const asDate = (value: unknown): Date | null => {
    if (value === null || value === undefined || value === "") return null
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
    let parsed: Date | null = null
    if (typeof value === "string") {
        parsed = new Date(/^\d{4}-\d\d-\d\d \d/u.test(value) ? value.replace(" ", "T") : value)
    } else if (typeof value === "number") {
        parsed = new Date(value)
    }
    return parsed === null || Number.isNaN(parsed.getTime()) ? null : parsed
}

const textOf = (value: unknown): string => {
    const plain = plainValue(value)
    return typeof plain === "string" ? plain : (JSON.stringify(plain) ?? "")
}

const idText = (value: unknown): string => (typeof value === "string" ? value : textOf(value))

/** One driver row as a hub record; a row with no id is skipped (null). */
export const toRecord = (selection: DatabaseSelection, row: DatabaseRow): DatabaseRecord | null => {
    const id = row[selection.idColumn]
    if (id === null || id === undefined || idText(id) === "") return null
    const data: Record<string, unknown> = {}
    for (const column of selection.columns) data[column] = plainValue(row[column])
    const title = selection.titleColumn === "" ? null : row[selection.titleColumn]
    return {
        externalId: idText(id),
        title: title === null || title === undefined ? idText(id) : textOf(title),
        occurredAt:
            selection.updatedColumn === "" ? null : (asDate(row[selection.updatedColumn])?.toISOString() ?? null),
        data,
    }
}

/** The newest cursor value of a page of rows (the last row that has one), or null. */
export const cursorOf = (rows: ReadonlyArray<DatabaseRow>): string | null => {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const value = rows[index]?.[DATABASE_CURSOR]
        if (value !== null && value !== undefined) return idText(value)
    }
    return null
}

/** Row cells as short text for the wizard preview. */
export const previewCells = (
    columns: ReadonlyArray<string>,
    rows: ReadonlyArray<DatabaseRow>,
): ReadonlyArray<ReadonlyArray<string>> =>
    rows.map((row) =>
        columns.map((column) => {
            const value = plainValue(row[column])
            return value === null ? "" : textOf(value).slice(0, PREVIEW_CELL)
        }),
    )
