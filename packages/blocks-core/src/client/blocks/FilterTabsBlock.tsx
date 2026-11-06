import type { ReactElement } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Tabs } from "@starci/grammar/common"
import type { filterTabsBlock } from "../../blocks/filter-tabs.block"
import {
    countsView,
    EMPTY_TAB_COUNTS,
    moreLabelOf,
    selectedTab,
    tabEntriesOf,
    TAB_COUNTS_PLACEHOLDER,
    tabParamValue,
    tabRowsView,
    tabSpecsOf,
} from "../../rows/filter-tabs"
import type { TabCounts } from "../../rows/filter-tabs"
import { parsedSlot } from "../../slots/slots"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/**
 * Underline filter tabs over a list, each with the count of its rows; the chosen tab is written to the param. The tabs are the
 * spec's literal items, or the rows of the bound items read; while that read loads, the tabs wait with no counts.
 */
export const FilterTabsBlock = (props: RenderOf<typeof filterTabsBlock>): ReactElement => {
    const words = useBlockWords()
    const labels = useSlotLabels()
    const read = props.slots.counts
    const counts = parsedSlot(read.slot, countsView)
    const literal = (props.props.items ?? []).map((item) => ({
        value: item.value,
        label: words(item.label),
        attention: item.attention === true,
    }))
    const rows = parsedSlot(props.slots.items.slot, tabRowsView)
    const fromRead = "items" in rows ? tabSpecsOf(rows.items, (key) => words({ key })) : []
    const specs = literal.length > 0 ? literal : fromRead
    const moreTemplate = words({ key: "filtersMore" })
    const tabs = (view: TabCounts | null): ReactElement => (
        <Tabs
            kind="filter"
            label={words(props.props.label ?? { key: "filtersLabel" })}
            moreLabel={(count) => moreLabelOf(moreTemplate, count)}
            overflowLabel={words({ key: "filtersOverflow" })}
            inset="none"
            selectedKey={selectedTab(props.params.value(props.props.param), specs)}
            items={tabEntriesOf(words(props.props.all), specs, view)}
            onSelect={(key) => props.params.set(props.props.param, tabParamValue(key))}
        />
    )
    if ("isLoading" in rows || "isError" in counts) return tabs(null)
    if ("isEmpty" in counts) return tabs(EMPTY_TAB_COUNTS)
    return (
        <SlotView
            slot={counts}
            labels={labels}
            placeholder={TAB_COUNTS_PLACEHOLDER}
            forbidden="hide"
            render={(view, isLoading) => tabs(isLoading ? null : view)}
        />
    )
}
