import { z } from "zod"
import { textOf, valueAt } from "../slots/paths"

/** One row of a record list as the block draws it; an empty badge draws no badge. */
export interface RecordRow {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badge: string
}

/** The dotted paths of a record that name the parts of its row. */
export interface RowPaths {
    readonly idPath: string
    readonly titlePath: string
    readonly descriptionPath?: string | undefined
    readonly badgePath?: string | undefined
}

/** The shape of a bound list: any records, read through paths. */
export const recordsView: z.ZodType<ReadonlyArray<unknown>> = z.array(z.unknown())

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
