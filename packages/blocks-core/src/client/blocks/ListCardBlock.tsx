import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { SurfaceCard, type FilterFields } from "@starci/grammar/common"
import { surfaceFrame } from "../composites/surfaceFrame"
import type { listCardBlock } from "../../blocks/list-card.block"
import { countsView, moreLabelOf, selectedTab, tabEntriesOf, tabParamValue, type TabSpec } from "../../rows/filter-tabs"
import { footersOf, tabCountsOf } from "../../rows/list-card"
import { paneHeadersOf } from "../../rows/pane-headers"
import { RECORD_ROWS_PLACEHOLDER, moreStateOf, recordsView, rowsOf } from "../../rows/rows"
import { queryOf } from "../../rows/search"
import { relabeller } from "../../rows/value-labels"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { SelectableRows } from "../composites/SelectableRows"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import { usePaneSearch } from "../composites/usePaneSearch"
import type { RenderOf } from "../render-props"

/** A list of records as one card: the filter tabs and the search in its header, the rows (one chosen) under them, the next page in its footer. */
export const ListCardBlock = (props: RenderOf<typeof listCardBlock>): ReactNode => {
    const words = useBlockWords()
    const block = props.props
    const searchParam = block.searchParam
    const searched = searchParam === undefined ? null : queryOf(props.params.value(searchParam))
    const labels = useSlotLabels(searched === null ? block.empty : (block.emptySearch ?? { key: "listSearchEmpty" }))
    const read = props.slots.rows
    const rows = derivedSlot(parsedSlot(read.slot, recordsView), (records) =>
        rowsOf(records, block, relabeller(block.labels, words), words({ key: "rowUntitled" })),
    )
    const specs: ReadonlyArray<TabSpec> = (block.filters ?? []).map((item) => ({
        value: item.value,
        label: words(item.label),
        attention: item.attention === true,
    }))
    const moreTemplate = words({ key: "filtersMore" })
    const counts = tabCountsOf(parsedSlot(props.slots.counts.slot, countsView))
    const filterParam = block.filterParam
    const filter: FilterFields | null =
        filterParam === undefined || block.filterAll === undefined
            ? null
            : {
                  label: words(block.filterLabel ?? { key: "filtersLabel" }),
                  items: tabEntriesOf(words(block.filterAll), specs, counts),
                  selectedKey: selectedTab(props.params.value(filterParam), specs),
                  onSelect: (key) => props.params.set(filterParam, tabParamValue(key)),
                  moreLabel: (count) => moreLabelOf(moreTemplate, count),
                  overflowLabel: words({ key: "filtersOverflow" }),
              }
    const search = usePaneSearch(props.params, block.search ? searchParam : undefined, {
        label: words(block.searchLabel ?? { key: "searchLabel" }),
        clearLabel: words({ key: "searchClear" }),
    })
    const headers = paneHeadersOf(filter, search)
    const moreWords = { loadMore: words({ key: "listLoadMore" }), retry: labels.retry }
    const label = words(block.label)
    const name =
        block.title === undefined ? { ariaLabel: label } : { label: words(block.title), headingLevel: 3 as const }
    return (
        <SlotView
            slot={rows}
            labels={labels}
            placeholder={RECORD_ROWS_PLACEHOLDER}
            onRetry={read.retry}
            frame={surfaceFrame({ ...name, headers })}
            {...(searched === null
                ? {}
                : {
                      emptyAction: {
                          label: words({ key: "searchClear" }),
                          onAction: () => props.params.set(searchParam ?? "", null),
                      },
                  })}
            render={(items, isLoading) => (
                <SurfaceCard
                    {...name}
                    headers={headers}
                    footers={read.page === null ? [] : footersOf(moreStateOf(read.page), moreWords, read.page.loadMore)}
                    isLoading={isLoading}
                >
                    <SelectableRows
                        rows={items}
                        selected={props.params.value(block.selectParam)}
                        isLoading={isLoading}
                        hasAvatar={block.avatar === true}
                        page={null}
                        onChoose={(id) => props.params.set(block.selectParam, id)}
                        words={{ label, loadMore: moreWords.loadMore, loadFailed: "", retry: moreWords.retry }}
                    />
                </SurfaceCard>
            )}
        />
    )
}
