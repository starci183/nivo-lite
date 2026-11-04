import { z } from "zod"
import { textOf, valueAt } from "../slots/paths"

/** One row of a record list as the block draws it; an empty badge draws no badge. */
export interface RecordRow {
    /** The key the list draws the row under; a record without one draws no row. */
    readonly id: string
    /** The headline of the row. */
    readonly title: string
    /** The line of detail under the headline; empty draws none. */
    readonly description: string
    /** The words of the mark beside the headline; empty draws no badge. */
    readonly badge: string
}

/** The dotted paths of a record that name the parts of its row. */
export interface RowPaths {
    /** The path of the text that identifies the record. */
    readonly idPath: string
    /** The path of the text that heads the row. */
    readonly titlePath: string
    /** The path of the line under the headline; absent draws none. */
    readonly descriptionPath?: string | undefined
    /** The path of the text of the badge; absent draws none. */
    readonly badgePath?: string | undefined
}

/** The most records one bound list carries; a longer one is a failed read, never a half list. */
const RECORDS_MAX = 500

/** The shape of a bound list: records of any fields, read through paths. */
export const recordsView: z.ZodType<ReadonlyArray<unknown>> = z.array(z.looseObject({})).max(RECORDS_MAX)

/** The rows a skeleton draws. */
const PLACEHOLDER_COUNT = 3
const BLANK = "........"

/** Rows with the geometry of settled ones, for the skeleton of a list. */
export const RECORD_ROWS_PLACEHOLDER: ReadonlyArray<RecordRow> = Array.from(
    { length: PLACEHOLDER_COUNT },
    (_, index) => ({
        id: `placeholder-${index}`,
        title: BLANK,
        description: BLANK,
        badge: "",
    }),
)

/** The text at an optional path of a record; nothing without a path. */
const textAt = (record: unknown, path: string | undefined): string =>
    path === undefined ? "" : textOf(valueAt(record, path))

/** The row of one record; a record without a text id draws no row. */
const rowOf = (record: unknown, paths: RowPaths): ReadonlyArray<RecordRow> => {
    const id = textOf(valueAt(record, paths.idPath))
    if (id === "") return []
    return [
        {
            id,
            title: textOf(valueAt(record, paths.titlePath)),
            description: textAt(record, paths.descriptionPath),
            badge: textAt(record, paths.badgePath),
        },
    ]
}

/** The rows of a bound list, or null when none can be drawn, which the block reads as an empty slot. */
export const rowsOf = (records: ReadonlyArray<unknown>, paths: RowPaths): ReadonlyArray<RecordRow> | null => {
    const rows = records.flatMap((record) => rowOf(record, paths))
    return rows.length === 0 ? null : rows
}
