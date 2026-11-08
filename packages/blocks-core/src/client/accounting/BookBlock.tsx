import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import { surfaceFrame } from "../composites/surfaceFrame"
import type { accountingBookBlock } from "../../blocks/accounting/book.block"
import {
    bookPeriodOf,
    bookRecords,
    bookRowsOf,
    bookSubtitleOf,
    phoneCardOf,
    type BookRow,
} from "../../rules/accounting/book-view"
import { ENTRY_STATUSES, type EntryStatus } from "../../rules/accounting/entry-status"
import {
    EMPTY_TAB_COUNTS,
    countsView,
    selectedTab,
    tabEntriesOf,
    tabParamValue,
    TAB_COUNTS_PLACEHOLDER,
    type TabCounts,
} from "../../rows/filter-tabs"
import { queryOf } from "../../rows/search"
import { paneHeadersOf } from "../../rows/pane-headers"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import { usePaneSearch } from "../composites/usePaneSearch"
import type { RenderOf } from "../render-props"

/** The rows a skeleton draws while the first read is in flight. */
const PLACEHOLDER: ReadonlyArray<BookRow> = Array.from({ length: 3 }, (_, index) => ({
    id: `placeholder-${index}`,
    date: "..../..",
    title: "........",
    subline: "........",
    amount: "........",
    status: "........",
    tone: "neutral",
}))

/** The counts the tabs show: the answer, none while it loads or failed, zeros when the read is empty. */
const tabCountsOf = (counts: ReturnType<typeof parsedSlot<TabCounts>>): TabCounts | null => {
    if ("items" in counts) return counts.items
    return "isEmpty" in counts ? EMPTY_TAB_COUNTS : null
}

/** The books: the head, the search, the status tabs with their counts and the entries as rows. */
export const BookBlock = (props: RenderOf<typeof accountingBookBlock>): ReactNode => {
    const words = useBlockWords()
    const spec = props.props
    const query = queryOf(props.params.value(spec.searchParam))
    const labels = useSlotLabels(query === null ? spec.empty : spec.emptySearch)
    const searchFields = usePaneSearch(props.params, spec.searchParam, {
        label: words(spec.searchLabel),
        clearLabel: words({ key: "searchClear" }),
    })
    const select = (chosen: string | null): void =>
        props.params.setMany({
            [spec.selectParam]: chosen,
            [spec.paneParam]: chosen === null ? "list" : "detail",
        })
    const statusWord = (status: EntryStatus): string => words({ key: `status_${status}` })
    const rows = derivedSlot(parsedSlot(props.slots.rows.slot, bookRecords), (records) =>
        records.length === 0 ? null : bookRowsOf(records, statusWord),
    )
    const counts = parsedSlot(props.slots.counts.slot, countsView)
    const total = "items" in counts ? counts.items.total : 0
    const period = words({ key: `book_period_${bookPeriodOf(props.params.value(spec.periodParam))}` })
    const specs = ENTRY_STATUSES.map((status) => ({
        value: status,
        label: words({ key: `tab_${status}` }),
        attention: status === "review",
    }))
    const tabCounts = tabCountsOf(counts)
    const headers = paneHeadersOf(
        {
            label: words({ key: "book_filters" }),
            moreLabel: (count) => words({ key: "filtersMore" }).replaceAll("{count}", String(count)),
            overflowLabel: words({ key: "filtersOverflow" }),
            selectedKey: selectedTab(props.params.value(spec.filterParam), specs),
            items: tabEntriesOf(words({ key: "filter_all" }), specs, tabCounts ?? TAB_COUNTS_PLACEHOLDER),
            onSelect: (key) => props.params.set(spec.filterParam, tabParamValue(key)),
        },
        searchFields,
    )
    const head = {
        label: words(spec.title),
        headingLevel: 3 as const,
        fact: bookSubtitleOf(period, total, words({ key: "book_count" })),
        headers,
    }
    return (
        <SlotView
            slot={rows}
            labels={labels}
            placeholder={PLACEHOLDER}
            onRetry={props.slots.rows.retry}
            frame={surfaceFrame(head)}
            render={(items, isLoading) => (
                <SurfaceCard
                    kind="list"
                    {...head}
                    isLoading={isLoading}
                    items={items
                        .map((row) => phoneCardOf(row))
                        .map((card) => ({
                            id: card.id,
                            title: card.title,
                            description: card.description,
                            meta: { text: card.amount },
                            badges: [{ label: card.status, tone: card.tone, isDot: true }],
                            onPress: () => select(card.id),
                        }))}
                    empty={<EmptyNotice message={labels.empty} />}
                />
            )}
        />
    )
}
