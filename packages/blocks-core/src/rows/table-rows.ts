import { textOf, valueAt } from "../slots/paths"
import { cellTextOf } from "./cell-format"
import type { CellContext, CellFormat } from "./cell-format"

/** The tones a badge cell may take. */
export const CELL_TONES = ["neutral", "accent", "info", "success", "warning", "danger", "muted"] as const

/** One tone of a badge cell. */
export type CellTone = (typeof CELL_TONES)[number]

/** The paths and format that make one column of a table. */
export interface TableColumnPaths {
    /** The path of the cell's value in a record. */
    readonly path: string
    /** How the value is drawn; absent draws it as text. */
    readonly format?: CellFormat | undefined
    /** The path of the line of text under the cell's value; absent draws none. */
    readonly subPath?: string | undefined
    /** The tone of a badge cell by the raw value of the cell; a value with no tone draws neutral. */
    readonly tones?: Readonly<Record<string, CellTone>> | undefined
}

/** What decides where a column's cells line up. */
export interface ColumnLook {
    /** How the cells are drawn. */
    readonly format?: CellFormat | undefined
    /** Where the cells line up when the column says so. */
    readonly align?: "start" | "end" | undefined
}

/** One row of a table as the block draws it: the id and the text of each cell, by column id. */
export interface TableRow {
    /** The key the table draws the row under; a record without one draws no row. */
    readonly id: string
    /** The text of each cell, by the id of its column. */
    readonly cells: Readonly<Record<string, string>>
    /** The line of text under each cell's value, by the id of its column; a column with none has no entry. */
    readonly notes: Readonly<Record<string, string>>
    /** The tone of each badge cell, by the id of its column; a cell with none draws neutral. */
    readonly tones: Readonly<Record<string, CellTone>>
}

/** What a table needs to turn records into rows. */
export interface TableRowsSpec {
    /** The path of the text that identifies the record. */
    readonly idPath: string
    /** The columns, in the order they are drawn. */
    readonly columns: ReadonlyArray<TableColumnPaths>
    /** The viewer's language and money. */
    readonly context: CellContext
}

/** The rows a skeleton draws. */
const PLACEHOLDER_COUNT = 3
const BLANK = "........"

/** The id of the column at an index: stable across renders and unique in its table. */
export const columnIdOf = (index: number): string => `c${index}`

/** Rows with the geometry of settled ones, for the skeleton of a table. */
export const tablePlaceholder = (columnCount: number): ReadonlyArray<TableRow> =>
    Array.from({ length: PLACEHOLDER_COUNT }, (_, row) => ({
        id: `placeholder-${row}`,
        cells: Object.fromEntries(Array.from({ length: columnCount }, (__, column) => [columnIdOf(column), BLANK])),
        notes: {},
        tones: {},
    }))

/** The row of one record; a record without a text id draws no row. */
const rowOf = (record: unknown, spec: TableRowsSpec): ReadonlyArray<TableRow> => {
    const id = textOf(valueAt(record, spec.idPath))
    if (id === "") return []
    const cells = spec.columns.map((column, index): [string, string] => [
        columnIdOf(index),
        cellTextOf(valueAt(record, column.path), column.format, column.path, spec.context),
    ])
    const notes = spec.columns.flatMap((column, index): Array<[string, string]> => {
        const note = textOf(valueAt(record, column.subPath))
        return column.subPath === undefined || note === "" ? [] : [[columnIdOf(index), note]]
    })
    const tones = spec.columns.flatMap((column, index): Array<[string, CellTone]> => {
        const tone = column.tones?.[textOf(valueAt(record, column.path))]
        return tone === undefined ? [] : [[columnIdOf(index), tone]]
    })
    return [
        { id, cells: Object.fromEntries(cells), notes: Object.fromEntries(notes), tones: Object.fromEntries(tones) },
    ]
}

/** The rows of a bound list, or null when none can be drawn, which the block reads as an empty slot. */
export const tableRowsOf = (records: ReadonlyArray<unknown>, spec: TableRowsSpec): ReadonlyArray<TableRow> | null => {
    const rows = records.flatMap((record) => rowOf(record, spec))
    return rows.length === 0 ? null : rows
}

/** The column a column id names, or undefined for an id the table never issued. */
export const columnOfId = <C>(columns: ReadonlyArray<C>, columnId: string): C | undefined =>
    columns.find((_, index) => columnIdOf(index) === columnId)

/** What a cell draws: its text, and whether the text stands in a badge. */
export interface CellView {
    /** The words of the cell. */
    readonly text: string
    /** Whether the text is drawn as a badge; an empty cell draws none. */
    readonly isBadge: boolean
    /** The line of text under the value; empty draws none. */
    readonly note: string
    /** The tone of the badge. */
    readonly tone: CellTone
}

/** The cell of a row under a column id. */
export const cellOf = (columns: ReadonlyArray<TableColumnPaths>, row: TableRow, columnId: string): CellView => {
    const text = row.cells[columnId] ?? ""
    return {
        text,
        isBadge: text !== "" && columnOfId(columns, columnId)?.format === "badge",
        note: row.notes[columnId] ?? "",
        tone: row.tones[columnId] ?? "neutral",
    }
}

/** Where a column's cells line up: numbers and money at the end, unless the column says otherwise. */
export const alignOf = (column: ColumnLook): "start" | "end" => {
    if (column.align !== undefined) return column.align
    return column.format === "number" || column.format === "money" ? "end" : "start"
}

/** The ids a table marks as selected for the chosen id of its param. */
export const selectedIdsOf = (chosen: string | null): ReadonlyArray<string> => (chosen === null ? [] : [chosen])

/** The id a table writes to its param when the selection changes; none when the selection is cleared. */
export const chosenIdOf = (selection: ReadonlyArray<string> | "all"): string | null =>
    selection === "all" ? null : (selection[0] ?? null)
