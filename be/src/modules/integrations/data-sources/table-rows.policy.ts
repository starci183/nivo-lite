import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import { TABLE_COPY } from "./messages/table.messages"
import { TABLE_CELL_MAX, TABLE_MAX_BYTES, TABLE_MAX_COLUMNS, TABLE_MAX_ROWS } from "./table-shapes.contracts"
import type { DocumentKind, Table, TableFileKind } from "./table-shapes.contracts"

const ROW_FORMAT = new Intl.NumberFormat("vi-VN")

/** The refusal of an import, with the plain-Vietnamese sentence the owner reads. */
export const rejected = (detail: string, cause?: unknown): DataSourcesError =>
    new DataSourcesError({ code: DataSourcesErrorCode.Rejected, params: { detail }, cause })

const dateCell = (value: Date): string => {
    const iso = value.toISOString()
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso
}

/** One cell as trimmed text (dates as ISO, empty and non-finite values as an empty string). */
export const cellText = (value: unknown): string => {
    if (value === null || value === undefined) return ""
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : dateCell(value)
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : ""
    if (typeof value === "string") return value.trim().slice(0, TABLE_CELL_MAX)
    if (typeof value === "boolean") return String(value)
    return ""
}

/** Header row to unique, non-empty names (an empty name becomes "Column 1", a repeated one gets " (2)"). */
export const cleanHeaders = (row: ReadonlyArray<string>): ReadonlyArray<string> => {
    const seen = new Map<string, number>()
    return row.map((header, index) => {
        const base = (header || TABLE_COPY.columnName(index + 1)).slice(0, 120)
        const count = (seen.get(base) ?? 0) + 1
        seen.set(base, count)
        return count === 1 ? base : `${base} (${count})`
    })
}

/** The first non-empty row is the headers, the rest are data rows (completely empty rows are dropped). */
export const tableFromRows = (
    raw: ReadonlyArray<ReadonlyArray<unknown>>,
    extra: Pick<Table, "delimiter" | "sheets" | "sheet">,
): Table => {
    const all = raw.map((row) => row.map(cellText))
    const first = all.findIndex((row) => row.some(Boolean))
    const head = first < 0 ? undefined : all[first]
    if (head === undefined) throw rejected(TABLE_COPY.noData)
    let width = head.length
    while (width > 0 && !head[width - 1]) width -= 1
    if (width === 0) throw rejected(TABLE_COPY.headerRow)
    if (width > TABLE_MAX_COLUMNS) throw rejected(TABLE_COPY.tooManyColumns(TABLE_MAX_COLUMNS))
    const headers = cleanHeaders(head.slice(0, width))
    const rows = all
        .slice(first + 1)
        .filter((row) => row.some(Boolean))
        .map((row) => headers.map((_, index) => row[index] ?? ""))
    if (rows.length > TABLE_MAX_ROWS) {
        throw rejected(TABLE_COPY.tooManyRows(ROW_FORMAT.format(TABLE_MAX_ROWS)))
    }
    return { headers, rows, ...extra }
}

/** Rows typed or pasted in the grid. */
export const tableFromGrid = (headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string>>): Table =>
    tableFromRows([headers, ...rows], { delimiter: "", sheets: [], sheet: "" })

/** The text without a leading byte order mark. */
export const withoutBom = (text: string): string => (text.codePointAt(0) === 0xfeff ? text.slice(1) : text)

/** Decodes bytes as UTF-8 (a BOM is dropped) or as UTF-16 when the bytes carry a UTF-16 BOM. */
export const decodeText = (bytes: Uint8Array): string => {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2))
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2))
    return new TextDecoder("utf-8").decode(bytes)
}

/** True when the bytes are a zip archive (an .xlsx or .docx). */
export const isZip = (bytes: Uint8Array): boolean =>
    bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04

/** True when the first bytes hold a NUL and no UTF-16 BOM, so the file is not text. */
export const looksBinary = (bytes: Uint8Array): boolean =>
    bytes.subarray(0, 4096).includes(0) && !(bytes[0] === 0xff || bytes[0] === 0xfe)

const extensionOf = (name: string): string | undefined => /\.([a-z0-9]+)$/u.exec(name.toLowerCase())?.[1]

/** Which table format a file name says; null when it is neither. */
export const tableFileKind = (name: string): TableFileKind | null => {
    const extension = extensionOf(name)
    if (extension === "csv" || extension === "tsv" || extension === "txt") return "csv"
    return extension === "xlsx" ? "xlsx" : null
}

/** Which document format a file name says; null when it is none. */
export const documentKind = (name: string): DocumentKind | null => {
    const extension = extensionOf(name)
    if (extension === "docx") return "docx"
    if (extension === "pdf") return "pdf"
    return extension === "txt" || extension === "md" ? "text" : null
}

/** Refuses an empty file or one over ten megabytes. */
export const assertFileSize = (bytes: Uint8Array): void => {
    if (bytes.byteLength === 0) throw rejected(TABLE_COPY.fileEmpty)
    if (bytes.byteLength > TABLE_MAX_BYTES) throw rejected(TABLE_COPY.fileTooLarge)
}
