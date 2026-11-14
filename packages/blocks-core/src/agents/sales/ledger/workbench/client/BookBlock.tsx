import { useState, type ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Badge, EmptyNotice, Stack, SurfaceCard, type TableColumnData, type TableRowData } from "@starci/grammar/common"
import type { accountingBookBlock } from "../blocks/book.block"
import { bookRecords, bookRowsOf, orderCodeIn, type BookRow } from "../../rules/book-view"
import { ENTRY_STATUSES, type EntryStatus } from "../../rules/entry-status"
import { EMPTY_TAB_COUNTS, countsView, selectedTab, tabParamValue, type TabCounts } from "../../../../../shared/rows/filter-tabs"
import { queryOf } from "../../../../../shared/rows/search"
import { pagesOf } from "../../../../../shared/rows/table-pages"
import { derivedSlot, parsedSlot } from "../../../../../shared/slots/slots"
import { filterFieldsOf, footerZonesOf, headerZonesOf } from "../../../../../shared/client/composites/ListZones"
import { useBlockWords, useSlotLabels } from "../../../../../shared/client/composites/useBlockWords"
import { usePaneSearch } from "../../../../../shared/client/composites/usePaneSearch"
import type { RenderOf } from "../../../../../shared/client/render-props"

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

/** The columns of the table of the books; the content takes the rest of the row and the status folds on a narrow screen. */
const columnsOf = (words: ReturnType<typeof useBlockWords>): ReadonlyArray<TableColumnData> => [
    { id: "date", label: words({ key: "book_col_date" }), width: "fit" },
    { id: "content", label: words({ key: "book_col_content" }), width: "fill", minWidth: 200, truncate: true },
    { id: "amount", label: words({ key: "book_col_amount" }), numeric: true, width: "fit" },
    { id: "status", label: words({ key: "book_col_status" }), width: "fit", priority: "low" },
]

/** What a row says of its entry: the order code and the customer, so the raw transfer text stays in the detail; the text itself when it names neither. */
const contentOf = (row: BookRow): string => {
    const parts = [orderCodeIn(row.title), row.subline].filter((part) => part !== "")
    return parts.length === 0 ? row.title : parts.join(" \u00b7 ")
}

/** One row of the table of the books: the day, the document over its counterparty, the amount, and the status with its dot. */
const tableRowOf = (row: BookRow): TableRowData => ({
    id: row.id,
    cells: {
        date: row.date,
        content: contentOf(row),
        amount: row.amount,
        status: (
            <Badge tone={row.tone} isDot>
                {row.status}
            </Badge>
        ),
    },
})

/** The rows a page of the table shows. */
const PAGE_SIZE = 10

/** The page of the table in memory; it starts again at the first page whenever the search or the status choice changes. */
const useBookPage = (resetKey: string): readonly [number, (page: number) => void] => {
    const [chosen, setChosen] = useState({ key: resetKey, page: 1 })
    return [chosen.key === resetKey ? chosen.page : 1, (page) => setChosen({ key: resetKey, page })]
}

/** The books: a ribbon of how many documents stand in each status, then one card with the label and its count, the search, the status tabs, the entries as a table and the pager. */
export const BookBlock = (props: RenderOf<typeof accountingBookBlock>): ReactNode => {
    const words = useBlockWords()
    const spec = props.props
    const query = queryOf(props.params.value(spec.searchParam))
    const labels = useSlotLabels(query === null ? spec.empty : spec.emptySearch)
    const search = usePaneSearch(props.params, spec.searchParam, {
        label: words(spec.searchLabel),
        clearLabel: words({ key: "searchClear" }),
    })
    const select = (chosen: string): void =>
        props.params.setMany({ [spec.selectParam]: chosen, [spec.paneParam]: "detail" })
    const statusWord = (status: EntryStatus): string => words({ key: `status_${status}` })
    const rows = derivedSlot(parsedSlot(props.slots.rows.slot, bookRecords), (records) =>
        records.length === 0 ? null : bookRowsOf(records, statusWord),
    )
    const tabCounts = tabCountsOf(parsedSlot(props.slots.counts.slot, countsView))
    const specs = ENTRY_STATUSES.map((status) => ({
        value: status,
        label: words({ key: `tab_${status}` }),
        attention: status === "review",
    }))
    const filterKey = selectedTab(props.params.value(spec.filterParam), specs)
    const [chosenPage, setPage] = useBookPage(`${query ?? ""}|${filterKey}`)
    const filter = filterFieldsOf(
        {
            label: words({ key: "book_filters" }),
            allLabel: words({ key: "filter_all" }),
            specs,
            counts: tabCounts,
            selectedKey: filterKey,
            onSelect: (key) => props.params.set(spec.filterParam, tabParamValue(key)),
        },
        words,
    )
    const ribbon = ENTRY_STATUSES.map((status) => ({
        id: status,
        term: words({ key: `tab_${status}` }),
        value: String(tabCounts?.counts[status] ?? 0),
    }))
    return (
        <Stack gap="section">
            <SurfaceCard
                kind="figures"
                ariaLabel={words({ key: "book_figures" })}
                isLoading={tabCounts === null}
                items={ribbon}
            />
            <SlotView
                slot={rows}
                labels={labels}
                placeholder={PLACEHOLDER}
                onRetry={props.slots.rows.retry}
                render={(items, isLoading) => {
                    const paged = pagesOf(items, chosenPage, PAGE_SIZE)
                    return (
                        <SurfaceCard
                            kind="table"
                            label={words({ key: "book_head" })}
                            headingLevel={3}
                            count={tabCounts?.total ?? 0}
                            columns={columnsOf(words)}
                            rows={paged.rows.map((row) => tableRowOf(row))}
                            headers={headerZonesOf(search, filter)}
                            footers={footerZonesOf(
                                { page: paged.page, pageCount: paged.pageCount, onPage: setPage },
                                words,
                            )}
                            isLoading={isLoading}
                            empty={<EmptyNotice frame="frameless" message={labels.empty} />}
                            onRowAction={select}
                        />
                    )
                }}
            />
        </Stack>
    )
}
