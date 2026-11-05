import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Tabs } from "@starci/grammar/common"
import type { filterTabsBlock } from "../../blocks/filter-tabs.block"
import {
    countsView,
    moreLabelOf,
    selectedTab,
    tabEntriesOf,
    TAB_COUNTS_PLACEHOLDER,
    tabParamValue,
} from "../../rows/filter-tabs"
import { parsedSlot } from "../../slots/slots"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** Underline filter tabs over a list, each with the count of its rows; the chosen tab is written to the param. */
export const FilterTabsBlock = (props: RenderOf<typeof filterTabsBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels()
    const read = props.slots.counts
    const counts = parsedSlot(read.slot, countsView)
    const specs = props.props.items.map((item) => ({
        value: item.value,
        label: words(item.label),
        attention: item.attention === true,
    }))
    const moreTemplate = words({ key: "filtersMore" })
    return (
        <SlotView
            slot={counts}
            labels={labels}
            placeholder={TAB_COUNTS_PLACEHOLDER}
            forbidden="hide"
            empty="collapse"
            errorLayout="band"
            onRetry={read.retry}
            render={(view, isLoading) => (
                <Tabs
                    kind="filter"
                    label={words(props.props.label ?? { key: "filtersLabel" })}
                    moreLabel={(count) => moreLabelOf(moreTemplate, count)}
                    overflowLabel={words({ key: "filtersOverflow" })}
                    inset="none"
                    selectedKey={selectedTab(props.params.value(props.props.param), specs)}
                    items={tabEntriesOf(words(props.props.all), specs, isLoading ? null : view)}
                    onSelect={(key) => props.params.set(props.props.param, tabParamValue(key))}
                />
            )}
        />
    )
}
