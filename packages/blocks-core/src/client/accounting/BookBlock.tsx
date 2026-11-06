import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import {
    Badge,
    Cluster,
    DataTable,
    EmptyNotice,
    Heading,
    SearchField,
    Section,
    Stack,
    Tabs,
    Text,
} from "@starci/grammar/common"
import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { accountingBookBlock } from "../../blocks/accounting/book.block"
import { bookPeriodOf, bookRecords, bookRowsOf, bookSubtitleOf, phoneCardOf } from "../../rules/accounting/book-view"
import type { BookRow } from "../../rules/accounting/book-view"
import { ENTRY_STATUSES } from "../../rules/accounting/entry-status"
import type { EntryStatus } from "../../rules/accounting/entry-status"
import {
    EMPTY_TAB_COUNTS,
    countsView,
    selectedTab,
    tabEntriesOf,
    tabParamValue,
    TAB_COUNTS_PLACEHOLDER,
} from "../../rows/filter-tabs"
import type { TabCounts } from "../../rows/filter-tabs"
import { chosenIdOf, selectedIdsOf } from "../../rows/table-rows"
import { queryOf } from "../../rows/search"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import { useIsPhone } from "../composites/useIsPhone"
import { useSearchText } from "../composites/useSearchText"
import type { RenderOf } from "../render-props"

const COLUMNS = ["date", "entry", "amount", "status"] as const

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

/** What the cell of one column of a row draws. */
interface BookCellProps {
    readonly row: BookRow
    readonly column: (typeof COLUMNS)[number]
}

/** One cell of the book: the day, the two lines of the entry, the amount, or the status mark. */
const BookCell = (props: BookCellProps): ReactNode => {
    const { row } = props
    switch (props.column) {
        case "date":
            return <>{row.date}</>
        case "entry":
            return (
                <Stack gap="inline">
                    <Text size="sm" isStrong>
                        {row.title}
                    </Text>
                    {row.subline === "" ? null : (
                        <Text size="sm" tone="muted">
                            {row.subline}
                        </Text>
                    )}
                </Stack>
            )
        case "amount":
            return <>{row.amount}</>
        case "status":
            return (
                <Badge tone={row.tone} isDot>
                    {row.status}
                </Badge>
            )
    }
}

/** What the entries of the book are given. */
interface BookEntriesProps {
    readonly items: ReadonlyArray<BookRow>
    readonly isLoading: boolean
    readonly isPhone: boolean
    readonly title: string
    readonly emptyLabel: string
    /** The id of the chosen entry, from the address. */
    readonly selectedId: string | null
    /** Chooses an entry, or none. */
    readonly onSelect: (chosen: string | null) => void
}

/** The entries: a list of cards on a phone, a table of rows elsewhere. */
const BookEntries = (props: BookEntriesProps): ReactNode => {
    const words = useBlockWords()
    if (props.isPhone) {
        return (
            <Section
                kind="list"
                ariaLabel={props.title}
                isLoading={props.isLoading}
                items={props.items.map(phoneCardOf).map((card) => ({
                    id: card.id,
                    title: card.title,
                    description: card.description,
                    meta: { text: card.amount },
                    badges: [{ label: card.status, tone: card.tone, isDot: true }],
                    onPress: () => props.onSelect(card.id),
                }))}
                empty={<EmptyNotice message={props.emptyLabel} />}
            />
        )
    }
    return (
        <DataTable
            label={props.title}
            columns={COLUMNS.map((column, index) => ({
                id: column,
                label: words({ key: `col_${column}` }),
                isRowHeader: index === 1,
                align: column === "amount" ? "end" : "start",
                priority: column === "status" || column === "date" ? "low" : "high",
            }))}
            rows={props.items}
            renderCell={(row, column) => (
                <BookCell row={row} column={COLUMNS.find((candidate) => candidate === column) ?? "date"} />
            )}
            isLoading={props.isLoading}
            emptyContent={<EmptyNotice message={props.emptyLabel} />}
            selectionMode="single"
            selectedIds={selectedIdsOf(props.selectedId)}
            onSelectionChange={(ids) => props.onSelect(chosenIdOf(ids))}
        />
    )
}

/** The counts the status tabs show: the read's own, the empty ones when the book is empty, none while it loads or failed. */
const tabCountsOf = (counts: DataSlot<TabCounts>): TabCounts | null => {
    if ("items" in counts) return counts.items
    return "isEmpty" in counts ? EMPTY_TAB_COUNTS : null
}

/** The books: the head, the search, the status tabs with their counts and the entries as rows. */
export const BookBlock = (props: RenderOf<typeof accountingBookBlock>): ReactNode => {
    const words = useBlockWords()
    const isPhone = useIsPhone()
    const spec = props.props
    const query = queryOf(props.params.value(spec.searchParam))
    const labels = useSlotLabels(query === null ? spec.empty : spec.emptySearch)
    const search = useSearchText(props.params.value(spec.searchParam), (value) =>
        props.params.set(spec.searchParam, value),
    )
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
    return (
        <Stack gap="row">
            <Cluster gap="inline" align="center">
                <Heading level={3}>{words(spec.title)}</Heading>
                <Text size="sm" tone="muted">
                    {bookSubtitleOf(period, total, words({ key: "book_count" }))}
                </Text>
            </Cluster>
            <SearchField
                label={words(spec.searchLabel)}
                isLabelHidden
                placeholder={words(spec.searchLabel)}
                clearLabel={words({ key: "searchClear" })}
                value={search.text}
                onValueChange={search.type}
                onClear={search.clear}
            />
            <Tabs
                kind="filter"
                label={words({ key: "book_filters" })}
                moreLabel={(count) => words({ key: "filtersMore" }).replaceAll("{count}", String(count))}
                overflowLabel={words({ key: "filtersOverflow" })}
                inset="none"
                selectedKey={selectedTab(props.params.value(spec.filterParam), specs)}
                items={tabEntriesOf(words({ key: "filter_all" }), specs, tabCounts ?? TAB_COUNTS_PLACEHOLDER)}
                onSelect={(key) => props.params.set(spec.filterParam, tabParamValue(key))}
            />
            <SlotView
                slot={rows}
                labels={labels}
                placeholder={PLACEHOLDER}
                onRetry={props.slots.rows.retry}
                render={(items, isLoading) => (
                    <BookEntries
                        items={items}
                        isLoading={isLoading}
                        isPhone={isPhone}
                        title={words(spec.title)}
                        emptyLabel={labels.empty}
                        selectedId={props.params.value(spec.selectParam)}
                        onSelect={select}
                    />
                )}
            />
        </Stack>
    )
}
