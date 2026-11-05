import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { listPaneBlock } from "../blocks/list-pane.block"
import type { recordListBlock } from "../blocks/record-list.block"
import type { TabCounts } from "../rows/filter-tabs"
import { FILTER_TABS_COUNTS, FILTER_TABS_COUNTS_NONE } from "./filter-tabs.fixtures"
import data from "./list-pane.data.json"

/** The props a spec gives a list pane that searches through the `q` param. */
export const LIST_PANE_PROPS: z.input<typeof listPaneBlock.props> = data.paneProps

/** The props a spec gives the selectable list inside the pane. */
export const LIST_PANE_ROWS_PROPS: z.input<typeof recordListBlock.props> = data.rowsProps

/** The rows of a ready list. */
export const LIST_PANE_ROWS: ReadonlyArray<Readonly<Record<string, string>>> = data.rows

/** One state of the whole pane. Every region is in the same state: a loading pane loads its tabs and rows together. */
export interface ListPaneFixture {
    /** The name of the state the fixture draws. */
    readonly state: "ready" | "loading" | "empty" | "emptyWithSearch" | "error"
    /** The values of the spec params in the URL. */
    readonly params: Readonly<Record<string, string>>
    /** The status of the counts read the filter tabs are bound to. */
    readonly counts: DataSlot<TabCounts>
    /** The status of the rows read the list is bound to. */
    readonly rows: DataSlot<ReadonlyArray<Readonly<Record<string, string>>>>
}

/** The pane in every state a person meets. */
export const LIST_PANE_FIXTURES: ReadonlyArray<ListPaneFixture> = [
    {
        state: "ready",
        params: { selected: "c2" },
        counts: { items: FILTER_TABS_COUNTS },
        rows: { items: LIST_PANE_ROWS },
    },
    { state: "loading", params: {}, counts: { isLoading: true }, rows: { isLoading: true } },
    { state: "empty", params: {}, counts: { items: FILTER_TABS_COUNTS_NONE }, rows: { isEmpty: true } },
    {
        state: "emptyWithSearch",
        params: { q: "zzz" },
        counts: { items: FILTER_TABS_COUNTS_NONE },
        rows: { isEmpty: true },
    },
    { state: "error", params: {}, counts: { isError: true }, rows: { isError: true } },
]
