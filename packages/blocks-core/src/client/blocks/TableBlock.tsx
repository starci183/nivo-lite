import { useState, type ReactNode } from "react"
import { SlotView, useBlockHost, type SlotLabels } from "@nivo-lite/agent-sdk/client"
import type { ReadPage } from "@nivo-lite/agent-sdk/block"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import {
    type FilterFields,
    type FooterZone,
    type SearchFields,
    type TableColumnData,
    Alert,
    Badge,
    Button,
    DataTable,
    EmptyNotice,
    Pagination,
    Section,
    Stack,
    SurfaceCard,
    Text,
    type DataTableColumn,
    type DataTableRow,
} from "@starci/grammar/common"
import type { tableBlock } from "../../blocks/table.block"
import { cellContextOf } from "../../rows/cell-format"
import { recordsView } from "../../rows/rows"
import {
    alignOf,
    cellOf,
    columnIdOf,
    tablePlaceholder,
    tableRowsOf,
    type CellView,
    type TableRow,
} from "../../rows/table-rows"
import { countsView, selectedTab, tabParamValue } from "../../rows/filter-tabs"
import { queryOf } from "../../rows/search"
import { pagesOf } from "../../rows/table-pages"
import { relabeller } from "../../rows/value-labels"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { useInCard } from "../composites/CardScope"
import { filterFieldsOf, footerZonesOf, headerZonesOf, type PagingInput } from "../composites/ListZones"
import { usePaneSearch } from "../composites/usePaneSearch"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** What the paging control of the table takes. */
interface MoreRowsProps {
    readonly page: ReadPage
    readonly loadMoreLabel: string
    readonly labels: SlotLabels
}

/** What the table draws under its rows when the read has more: the way to load them, or the way to try again. */
const MoreRows = (props: MoreRowsProps): ReactNode => {
    const { page } = props
    if (page.failure) {
        return (
            <Alert
                tone="negative"
                title={props.labels.error}
                action={{ label: props.labels.retry, onAction: page.loadMore }}
            />
        )
    }
    if (!page.hasMore) return null
    return (
        <Button intent="neutral" isPending={page.isLoadingMore} onPress={page.loadMore}>
            {props.loadMoreLabel}
        </Button>
    )
}

/** What the content of a cell takes. */
interface TableCellProps {
    readonly cell: CellView
}

/** One cell: its text, in a badge of its tone for a badge column, over its note when it has one. */
const TableCell = (props: TableCellProps): ReactNode => {
    const { cell } = props
    if (cell.text === "") return "\u2014"
    if (cell.isBadge) {
        return <Badge tone={cell.tone}>{cell.text}</Badge>
    }
    if (cell.note === "") return cell.text
    return (
        <Stack gap="inline">
            <Text size="sm" isStrong>
                {cell.text}
            </Text>
            <Text size="sm" tone="muted">
                {cell.note}
            </Text>
        </Stack>
    )
}

/** The page of a table in memory; it starts again at the first page whenever the search or the status choice changes. */
const useTablePage = (resetKey: string): readonly [number, (page: number) => void] => {
    const [chosen, setChosen] = useState({ key: resetKey, page: 1 })
    return [chosen.key === resetKey ? chosen.page : 1, (page) => setChosen({ key: resetKey, page })]
}

/** The columns of a table as the Grammar draws them: each with the width, truncation and fold the spec gave. */
const gridColumnsOf = (
    columns: RenderOf<typeof tableBlock>["props"]["columns"],
    words: (text: SpecText) => string,
): ReadonlyArray<TableColumnData> =>
    columns.map((column, index) => ({
        id: columnIdOf(index),
        label: words(column.term),
        align: alignOf(column),
        priority: column.priority ?? "high",
        ...(column.width === undefined ? {} : { width: column.width }),
        ...(column.minWidth === undefined ? {} : { minWidth: column.minWidth }),
        ...(column.truncate === true ? { truncate: true } : {}),
        ...(column.hideBelow === undefined ? {} : { hideBelow: column.hideBelow }),
    }))

/** Runs the row action of a table and tells the viewer when it did not go through. */
const useOpenRow = (open: RenderOf<typeof tableBlock>["slots"]["open"], failure: string): ((id: string) => void) => {
    const host = useBlockHost()
    return (id) => {
        open.run({ id })
            .then((outcome) => {
                if (!outcome.ok) host.notify("danger", failure)
            })
            .catch(() => host.notify("danger", failure))
    }
}

/** The filter tabs of a table with the counts its counts read gives; null when the spec asks for no filter. */
const useFilterFields = (props: RenderOf<typeof tableBlock>): FilterFields | null => {
    const words = useBlockWords()
    const { filterParam, filterAll, filters } = props.props
    if (filterParam === undefined || filterAll === undefined || filters === undefined) return null
    const specs = filters.map((item) => ({
        value: item.value,
        label: words(item.label),
        attention: item.isAttention === true,
    }))
    const counts = parsedSlot(props.slots.counts.slot, countsView)
    return filterFieldsOf(
        {
            label: words(props.props.filterLabel ?? { key: "filtersLabel" }),
            allLabel: words(filterAll),
            specs,
            counts: "items" in counts ? counts.items : null,
            selectedKey: selectedTab(props.params.value(filterParam), specs),
            onSelect: (key) => props.params.set(filterParam, tabParamValue(key)),
        },
        words,
    )
}

/** The search zone of a table, when the spec asks for one. */
const useSearchFields = (props: RenderOf<typeof tableBlock>): SearchFields | null => {
    const words = useBlockWords()
    const { search, searchParam } = props.props
    const fields = usePaneSearch(props.params, searchParam, {
        label: words(props.props.searchLabel ?? { key: "searchLabel" }),
        clearLabel: words({ key: "searchClear" }),
    })
    return search === true ? fields : null
}

/** The footer zones of a table: the pager, and the way to load more when the read has more. */
const useFooterZones = (
    props: RenderOf<typeof tableBlock>,
    paging: PagingInput,
    labels: SlotLabels,
    isLoading: boolean,
): ReadonlyArray<FooterZone> => {
    const words = useBlockWords()
    const page = props.slots.rows.page
    const more =
        page === null || isLoading || !(page.hasMore || page.failure)
            ? []
            : [
                  {
                      kind: "custom" as const,
                      children: (
                          <MoreRows page={page} loadMoreLabel={words({ key: "tableLoadMore" })} labels={labels} />
                      ),
                  },
              ]
    return [...footerZonesOf(paging, words), ...more]
}

/** One row of a table drawn in a card that already stands. */
interface InCardRow extends DataTableRow {
    readonly row: TableRow
}

/** What the table inside a card that already stands is given. */
interface TableInCardProps {
    readonly title: string
    readonly count: number
    readonly columns: ReadonlyArray<TableColumnData>
    readonly specColumns: RenderOf<typeof tableBlock>["props"]["columns"]
    readonly rows: ReadonlyArray<TableRow>
    readonly isLoading: boolean
    readonly empty: string
    readonly paging: PagingInput
    /** What the read has more to load: the way to load it or to try again. */
    readonly more: ReadonlyArray<ReactNode>
    readonly onRowAction?: (id: string) => void
}

/**
 * The table in a surface that already frames it (a card, a side pane): a surface never stands in a surface (COLLECTION-4), so the head is a
 * titled Section with its count chip, the table draws full bleed with no frame of its own (`surface="none"`), the pager is the table's foot.
 */
const TableInCard = (props: TableInCardProps): ReactNode => {
    const words = useBlockWords()
    const columns: ReadonlyArray<DataTableColumn<InCardRow>> = props.columns.map((column, index) => ({
        id: column.id,
        label: column.label,
        ...(index === 0 ? { isRowHeader: true } : {}),
        ...(column.align === undefined ? {} : { align: column.align }),
        ...(column.priority === undefined ? {} : { priority: column.priority }),
        ...(column.width === undefined ? {} : { width: column.width }),
        ...(column.minWidth === undefined ? {} : { minWidth: column.minWidth }),
        ...(column.truncate === undefined ? {} : { truncate: column.truncate }),
        ...(column.hideBelow === undefined ? {} : { hideBelow: column.hideBelow }),
    }))
    const { paging } = props
    return (
        <Section title={props.title} headingLevel={3} count={props.count} isLoading={props.isLoading}>
            <DataTable
                label={props.title}
                surface="none"
                columns={columns}
                rows={props.rows.map((row) => ({ id: row.id, row }))}
                renderCell={(item, columnId) => <TableCell cell={cellOf(props.specColumns, item.row, columnId)} />}
                isLoading={props.isLoading}
                emptyContent={<EmptyNotice frame="frameless" message={props.empty} />}
                {...(props.onRowAction === undefined ? {} : { onRowAction: props.onRowAction })}
                {...(paging.pageCount < 2
                    ? {}
                    : {
                          footer: (
                              <Pagination
                                  label={words({ key: "tablePagination" })}
                                  page={paging.page}
                                  pageCount={paging.pageCount}
                                  onPageChange={paging.onPage}
                                  previousLabel={words({ key: "tablePrevious" })}
                                  nextLabel={words({ key: "tableNext" })}
                                  pageLabel={(number) => `${words({ key: "tablePage" })} ${number}`}
                              />
                          ),
                      })}
            />
            {props.more}
        </Section>
    )
}

/** What one page of the table is drawn from. */
interface TableCardProps {
    readonly block: RenderOf<typeof tableBlock>
    readonly items: ReadonlyArray<TableRow>
    readonly isLoading: boolean
    readonly labels: SlotLabels
    readonly page: number
    readonly onPage: (page: number) => void
}

/** The card of a table: label with its count, the search and the filter tabs as header rows, the rows, the pager. */
const TableCard = (props: TableCardProps): ReactNode => {
    const { block, items } = props
    const words = useBlockWords()
    const inCard = useInCard()
    const { columns, selectParam } = block.props
    const search = useSearchFields(block)
    const filter = useFilterFields(block)
    const open = block.slots.open
    const openRow = useOpenRow(open, props.labels.error)
    const paged = pagesOf(items, props.page, block.props.pageSize)
    const gridColumns = gridColumnsOf(columns, words)
    const footers = useFooterZones(
        block,
        { page: paged.page, pageCount: paged.pageCount, onPage: props.onPage },
        props.labels,
        props.isLoading,
    )
    const onRow = (id: string): void => {
        if (selectParam !== undefined) block.params.set(selectParam, id)
        else openRow(id)
    }
    const hasRowAction = selectParam !== undefined || open.isAllowed
    if (inCard && search === null && filter === null) {
        return (
            <TableInCard
                title={words(block.props.title ?? block.props.label)}
                count={items.length}
                columns={gridColumns}
                rows={paged.rows}
                specColumns={columns}
                isLoading={props.isLoading}
                empty={props.labels.empty}
                paging={{ page: paged.page, pageCount: paged.pageCount, onPage: props.onPage }}
                more={footers.filter((zone) => zone.kind === "custom").map((zone) => zone.children)}
                {...(hasRowAction ? { onRowAction: onRow } : {})}
            />
        )
    }
    return (
        <SurfaceCard
            kind="table"
            label={words(block.props.title ?? block.props.label)}
            headingLevel={3}
            count={items.length}
            columns={gridColumns}
            rows={paged.rows.map((row) => ({
                id: row.id,
                cells: Object.fromEntries(
                    gridColumns.map((column) => [
                        column.id,
                        <TableCell key={column.id} cell={cellOf(columns, row, column.id)} />,
                    ]),
                ),
            }))}
            headers={headerZonesOf(search, filter)}
            footers={footers}
            isLoading={props.isLoading}
            empty={<EmptyNotice frame="frameless" message={props.labels.empty} />}
            {...(hasRowAction ? { onRowAction: onRow } : {})}
        />
    )
}

/** Records compared across columns in one card: the label with its count, the search, the filter tabs, the table and the pager, each a row the shell divides. */
export const TableBlock = (props: RenderOf<typeof tableBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const { columns, idPath, searchParam } = props.props
    const searched = searchParam === undefined ? null : queryOf(props.params.value(searchParam))
    const labels = useSlotLabels(
        searched === null ? props.props.empty : (props.props.emptySearch ?? { key: "listSearchEmpty" }),
    )
    const read = props.slots.rows
    const context = cellContextOf(host.locale(), props.props.currency, relabeller(props.props.labels, words))
    const rows = derivedSlot(parsedSlot(read.slot, recordsView), (records) =>
        tableRowsOf(records, { idPath, columns, context }),
    )
    const filterKey = props.props.filterParam === undefined ? "" : (props.params.value(props.props.filterParam) ?? "")
    const [chosenPage, setPage] = useTablePage(`${searched ?? ""}|${filterKey}`)
    return (
        <SlotView
            slot={rows}
            labels={labels}
            placeholder={tablePlaceholder(columns.length)}
            onRetry={read.retry}
            frame={(notice) => (
                <SurfaceCard label={words(props.props.title ?? props.props.label)} headingLevel={3}>
                    {notice}
                </SurfaceCard>
            )}
            render={(items, isLoading) => (
                <TableCard
                    block={props}
                    items={items}
                    isLoading={isLoading}
                    labels={labels}
                    page={chosenPage}
                    onPage={setPage}
                />
            )}
        />
    )
}
