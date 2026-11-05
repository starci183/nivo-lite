import type { ReadPage } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { textOf, valueAt } from "../slots/paths"
import type { Relabel } from "./value-labels"

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
    /** The short fact at the end of the headline line (a time, an amount); empty draws none. */
    readonly meta: string
    /** The words of the further marks after the badge, one chip each; empty ones are left out. */
    readonly chips: ReadonlyArray<string>
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
    /** The path of the short fact at the end of the headline line; absent draws none. */
    readonly metaPath?: string | undefined
    /** The paths of the further chips of the row, after the badge. */
    readonly chipPaths?: ReadonlyArray<string> | undefined
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
        meta: "",
        chips: [],
    }),
)

/** The text at an optional path of a record, in the words the labels give it; nothing without a path. */
const textAt = (record: unknown, path: string | undefined, relabel: Relabel): string =>
    path === undefined ? "" : relabel(path, textOf(valueAt(record, path)))

/** The row of one record; a record without a text id draws no row. */
const rowOf = (record: unknown, paths: RowPaths, relabel: Relabel): ReadonlyArray<RecordRow> => {
    const id = textOf(valueAt(record, paths.idPath))
    if (id === "") return []
    return [
        {
            id,
            title: relabel(paths.titlePath, textOf(valueAt(record, paths.titlePath))),
            description: textAt(record, paths.descriptionPath, relabel),
            badge: textAt(record, paths.badgePath, relabel),
            meta: textAt(record, paths.metaPath, relabel),
            chips: (paths.chipPaths ?? []).map((path) => textAt(record, path, relabel)).filter((text) => text !== ""),
        },
    ]
}

/** The rows of a bound list, or null when none can be drawn, which the block reads as an empty slot. */
export const rowsOf = (
    records: ReadonlyArray<unknown>,
    paths: RowPaths,
    relabel: Relabel,
): ReadonlyArray<RecordRow> | null => {
    const rows = records.flatMap((record) => rowOf(record, paths, relabel))
    return rows.length === 0 ? null : rows
}

/** The ids a selectable list marks as chosen: the row the selection param names, or none. */
export const selectionOf = (selected: string | null): ReadonlyArray<string> => (selected === null ? [] : [selected])

/** The row a selection change chooses; a change that chooses nothing (the chosen row pressed again) keeps the choice. */
export const chosenRow = (ids: ReadonlyArray<string>): string | null => ids[0] ?? null

/** Where the "load more" control of a list stands. */
export type MoreState = "none" | "idle" | "loading" | "failed"

/** The state of the control that loads the next page of a paged list; a list that is not paged has none. */
export const moreStateOf = (page: ReadPage | null): MoreState => {
    if (page === null) return "none"
    if (page.isLoadingMore) return "loading"
    if (page.failure) return "failed"
    return page.hasMore ? "idle" : "none"
}
