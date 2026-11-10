import { DocumentWarningCode, MAX_TABLE_ROWS } from "./document-readers.contracts"
import type { DocumentSection, DocumentTable, DocumentWarning } from "./document-readers.contracts"

/** A byte order mark of UTF-16 (little or big endian), or null. */
const utf16Of = (bytes: Uint8Array): "utf-16le" | "utf-16be" | null => {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le"
    return bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : null
}

/** True when the bytes look like a binary file rather than text: a NUL byte early on, with no UTF-16 mark. */
export const looksBinary = (bytes: Uint8Array): boolean =>
    bytes.subarray(0, 4096).includes(0) && utf16Of(bytes) === null

/** The text of a plain-text file: UTF-16 when it says so, else UTF-8 without its byte order mark; one newline style. */
export const decodeText = (bytes: Uint8Array): string => {
    const utf16 = utf16Of(bytes)
    const text =
        utf16 === null
            ? new TextDecoder("utf-8").decode(bytes).replace(/^﻿/u, "")
            : new TextDecoder(utf16).decode(bytes)
    return text.replace(/\r\n?/gu, "\n")
}

/** A Markdown heading line: its text, or null. */
const headingOf = (line: string): string | null => {
    const match = /^#{1,6}\s+(.+)$/u.exec(line.trim())
    return match?.[1]?.trim() ?? null
}

/** The headings of a Markdown-like text and the text under each; empty when it has no heading. */
export const sectionsOf = (text: string): Array<DocumentSection> => {
    const sections: Array<{ heading: string | null; lines: Array<string> }> = []
    let current: { heading: string | null; lines: Array<string> } = { heading: null, lines: [] }
    for (const line of text.split("\n")) {
        const heading = headingOf(line)
        if (heading === null) {
            current.lines.push(line)
            continue
        }
        sections.push(current)
        current = { heading, lines: [] }
    }
    sections.push(current)
    if (!sections.some((section) => section.heading !== null)) return []
    return sections
        .map((section) => ({ heading: section.heading, text: section.lines.join("\n").trim() }))
        .filter((section) => section.heading !== null || section.text !== "")
}

/** The cells of a delimited text, row by row: quoted cells may hold the delimiter, quotes and line breaks (RFC 4180). */
export const delimitedRows = (text: string, delimiter: string): Array<Array<string>> => {
    const rows: Array<Array<string>> = []
    let row: Array<string> = []
    let cell = ""
    let quoted = false
    let index = 0
    while (index < text.length) {
        const char = text[index] ?? ""
        if (quoted) {
            if (char === '"' && text[index + 1] === '"') {
                cell += '"'
                index += 2
                continue
            }
            if (char === '"') quoted = false
            else cell += char
            index += 1
            continue
        }
        if (char === '"' && cell === "") quoted = true
        else if (char === delimiter) {
            row.push(cell)
            cell = ""
        } else if (char === "\n") {
            row.push(cell)
            rows.push(row)
            row = []
            cell = ""
        } else cell += char
        index += 1
    }
    if (cell !== "" || row.length > 0) {
        row.push(cell)
        rows.push(row)
    }
    return rows
}

/** One cell as a table line carries it: one line, no pipe (the pipe separates cells), spaces tidied. */
export const cellText = (value: string): string => value.replace(/\s+/gu, " ").replaceAll("|", "/").trim()

/** The rows that hold something, each cut at its last filled cell. */
const filledRows = (rows: ReadonlyArray<ReadonlyArray<string>>): Array<Array<string>> =>
    rows
        .map((row) => row.map(cellText))
        .map((row) => {
            let end = row.length
            while (end > 0 && row[end - 1] === "") end -= 1
            return row.slice(0, end)
        })
        .filter((row) => row.length > 0)

/** A table as the text the chunker cuts by row: the header line first, then one line per row, cells joined by " | ". */
export const tableText = (table: DocumentTable): string =>
    [table.header, ...table.rows].map((row) => row.join(" | ")).join("\n")

/** A table from its rows, the first filled row as its header, at most `MAX_TABLE_ROWS` rows, with a warning when rows were left. */
export const tableOf = (
    name: string | null,
    rows: ReadonlyArray<ReadonlyArray<string>>,
): { readonly table: DocumentTable | null; readonly warnings: ReadonlyArray<DocumentWarning> } => {
    const [header, ...body] = filledRows(rows)
    if (header === undefined) return { table: null, warnings: [] }
    const kept = body.slice(0, MAX_TABLE_ROWS)
    const warnings: Array<DocumentWarning> =
        body.length > kept.length ? [{ code: DocumentWarningCode.RowsOverLimit, place: name, count: kept.length }] : []
    return { table: { name, header, rows: kept }, warnings }
}
