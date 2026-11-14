import type { Table } from "@modules/integrations/data-sources"
import type { CsvColumnKind, CsvConfig, CsvMapping } from "./csv-import.contracts"
import { looksLikeDate, parseNumberLoose } from "./csv-import-values.policy"

/** The most cells of a column read to tell how its values are written. */
const SAMPLE_CELLS = 200

/** The share of cells that must read as dates for the column to be read as a date. */
const DATE_SHARE = 0.8

/** How a column's cells are written, by the shape of the values alone (never by what the heading says): date, number, or text. */
const kindOf = (values: ReadonlyArray<string>): CsvColumnKind => {
    const filled = values.filter(Boolean).slice(0, SAMPLE_CELLS)
    if (filled.length === 0) return "text"
    const dates = filled.filter((value) => looksLikeDate(value)).length
    if (dates / filled.length >= DATE_SHARE) return "date"
    const numbers = filled.filter((value) => parseNumberLoose(value) !== null && !/^0\d/u.test(value.trim())).length
    return numbers === filled.length ? "number" : "text"
}

/**
 * The mapping a table starts with: no id, title or date column (the person maps each one in the wizard; no id column means the row
 * number), and every column read by the shape of its values.
 */
export const blankMapping = (table: Pick<Table, "headers" | "rows">): CsvMapping => {
    const { headers, rows } = table
    const kinds: Record<string, CsvColumnKind> = {}
    headers.forEach((header, index) => {
        kinds[header] = kindOf(rows.slice(0, SAMPLE_CELLS).map((row) => row[index] ?? ""))
    })
    return { idColumn: null, titleColumn: null, dateColumn: null, kinds, columns: headers }
}

/** The saved mapping carried over to new data: columns the data still has are kept, the others become unmapped. */
export const carryMapping = (saved: CsvConfig, table: Pick<Table, "headers" | "rows">): CsvMapping => {
    const blank = blankMapping(table)
    const keep = (column: string | null): string | null =>
        column !== null && table.headers.includes(column) ? column : null
    return {
        idColumn: keep(saved.idColumn),
        titleColumn: keep(saved.titleColumn),
        dateColumn: keep(saved.dateColumn),
        kinds: Object.fromEntries(
            table.headers.map((header) => [header, saved.kinds[header] ?? blank.kinds[header] ?? "text"]),
        ),
        columns: table.headers,
    }
}
