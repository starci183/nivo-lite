import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { filterTabsBlock } from "../blocks/filter-tabs.block"
import type { TabCounts } from "../rows/filter-tabs"
import data from "./filter-tabs.data.json"

/** The props a spec gives the filter tabs of a three-stage list; one of the stages waits for the viewer. */
export const FILTER_TABS_PROPS: z.input<typeof filterTabsBlock.props> = data.props

/** The counts the ready tabs show. */
export const FILTER_TABS_COUNTS: TabCounts = data.counts

/** The counts of a list that holds nothing: every tab stays and reads zero. */
export const FILTER_TABS_COUNTS_NONE: TabCounts = { counts: {}, total: 0 }

/** One state of the filter tabs: the value of the param and the status of the counts read. */
export interface FilterTabsFixture {
    /** The name of the state the fixture draws. */
    readonly state: "ready" | "selected" | "loading" | "empty" | "error"
    /** The value of the filter param, null when the URL has none. */
    readonly selected: string | null
    /** The status of the counts read. */
    readonly counts: DataSlot<TabCounts>
}

/** The filter tabs in every state a person meets. */
export const FILTER_TABS_FIXTURES: ReadonlyArray<FilterTabsFixture> = [
    { state: "ready", selected: null, counts: { items: FILTER_TABS_COUNTS } },
    { state: "selected", selected: "contacted", counts: { items: FILTER_TABS_COUNTS } },
    { state: "loading", selected: null, counts: { isLoading: true } },
    { state: "empty", selected: null, counts: { items: FILTER_TABS_COUNTS_NONE } },
    { state: "error", selected: null, counts: { isError: true } },
]
