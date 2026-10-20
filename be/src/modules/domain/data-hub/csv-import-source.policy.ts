import { TABLE_MAX_BYTES, TABLE_MAX_ROWS } from "@modules/integrations/data-sources"
import type { CsvDecodedFile, CsvGridRows, CsvUploadedFile } from "./csv-import.contracts"
import { CSV_COPY } from "./messages/csv-import.messages"
import { invalid, isPlainObject } from "./csv-import-config.policy"

/** An uploaded file's name and bytes; null when it is missing or empty. A file over ten megabytes (decoded) is refused. */
export const decodeUpload = (file: CsvUploadedFile | null | undefined): CsvDecodedFile | null => {
    if (file === null || file === undefined) return null
    const bytes = Buffer.from(file.contentBase64, "base64")
    if (bytes.byteLength === 0) return null
    if (bytes.byteLength > TABLE_MAX_BYTES) throw invalid(CSV_COPY.textTooLarge)
    return { name: file.name, bytes }
}

/** The pasted text; a refusal when it is empty or over ten megabytes. */
export const pastedText = (raw: string | null = ""): string => {
    if (raw === null || raw.trim() === "") throw invalid(CSV_COPY.pasteTable)
    if (Buffer.byteLength(raw) > TABLE_MAX_BYTES) throw invalid(CSV_COPY.textTooLarge)
    return raw
}

/** The typed grid ({headers, rows}) cleaned and bounded; a refusal when no column has a name. */
export const gridOf = (raw: unknown): CsvGridRows => {
    const grid = isPlainObject(raw) ? raw : {}
    const headers = Array.isArray(grid.headers) ? grid.headers.map((header) => cellOf(header, 120)) : []
    const rows = Array.isArray(grid.rows)
        ? grid.rows
              .slice(0, TABLE_MAX_ROWS + 1)
              .map((row) => (Array.isArray(row) ? row.map((cell) => cellOf(cell, 5_000)) : []))
        : []
    if (headers.every((header) => header.trim() === "")) throw invalid(CSV_COPY.nameAColumn)
    return { headers, rows }
}

const cellOf = (value: unknown, max: number): string => {
    if (typeof value === "string") return value.slice(0, max)
    if (typeof value === "number" || typeof value === "boolean") return String(value).slice(0, max)
    return ""
}
