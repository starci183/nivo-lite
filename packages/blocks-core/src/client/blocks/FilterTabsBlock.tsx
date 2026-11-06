import type { ReactElement } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Tabs } from "@starci/grammar/common"
import type { FilterFields } from "@starci/grammar/common"
import type { filterTabsBlock } from "../../blocks/filter-tabs.block"
import {
    countsView,
    EMPTY_TAB_COUNTS,
    moreLabelOf,
    selectedTab,
    tabEntriesOf,
    TAB_COUNTS_PLACEHOLDER,
    tabParamValue,
} from "../../rows/filter-tabs"
import type { TabCounts } from "../../rows/filter-tabs"
import { parsedSlot } from "../../slots/slots"
import { PublishFilter, useCardScope } from "../composites/CardScope"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/**
 * Underline filter tabs over a list, each with the count of its rows; the chosen tab is written to the param. Inside a list pane the
 * tabs are the filter zone of the pane's card: the block hands them to the card and draws nothing itself.
 */
export const FilterTabsBlock = (props: RenderOf<typeof filterTabsBlock>): ReactElement => {
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
    const scope = useCardScope()
    const tabs = (view: TabCounts | null): ReactElement => {
        const fields: FilterFields = {
            label: words(props.props.label ?? { key: "filtersLabel" }),
            moreLabel: (count) => moreLabelOf(moreTemplate, count),
            overflowLabel: words({ key: "filtersOverflow" }),
            selectedKey: selectedTab(props.params.value(props.props.param), specs),
            items: tabEntriesOf(words(props.props.all), specs, view),
            onSelect: (key) => props.params.set(props.props.param, tabParamValue(key)),
        }
        return scope?.filters == null ? (
            <Tabs kind="filter" inset="none" {...fields} />
        ) : (
            <PublishFilter store={scope.filters} fields={fields} />
        )
    }
    if ("isError" in counts) return tabs(null)
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
