import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { ReadPage } from "@nivo-lite/agent-sdk/block"
import type { SlotLabels } from "@nivo-lite/agent-sdk/client"
import { Alert, Badge, Button, DataTable, EmptyNotice, Stack } from "@starci/grammar/common"
import type { tableBlock } from "../../blocks/table.block"
import { cellContextOf } from "../../rows/cell-format"
import { recordsView } from "../../rows/rows"
import {
    alignOf,
    cellOf,
    chosenIdOf,
    columnIdOf,
    selectedIdsOf,
    tablePlaceholder,
    tableRowsOf,
} from "../../rows/table-rows"
import type { TableRow } from "../../rows/table-rows"
import { queryOf } from "../../rows/search"
import { relabeller } from "../../rows/value-labels"
import { derivedSlot, parsedSlot } from "../../slots/slots"
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

/** Records compared across columns, never in a card; the columns that may fold on a phone are the low priority ones. */
export const TableBlock = (props: RenderOf<typeof tableBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const { columns, idPath, selectParam, searchParam } = props.props
    const searched = searchParam === undefined ? null : queryOf(props.params.value(searchParam))
    const labels = useSlotLabels(
        searched === null ? props.props.empty : (props.props.emptySearch ?? { key: "listSearchEmpty" }),
    )
    const read = props.slots.rows
    const open = props.slots.open
    const context = cellContextOf(host.locale(), props.props.currency, relabeller(props.props.labels, words))
    const rows = derivedSlot(parsedSlot(read.slot, recordsView), (records) =>
        tableRowsOf(records, { idPath, columns, context }),
    )
    const openRow = (id: string): void => {
        open.run({ id })
            .then((outcome) => {
                if (!outcome.ok) host.notify("danger", labels.error)
            })
            .catch(() => host.notify("danger", labels.error))
    }
    const clearSearch =
        searchParam === undefined || searched === null
            ? {}
            : {
                  emptyAction: {
                      label: words({ key: "searchClear" }),
                      onAction: () => props.params.set(searchParam, null),
                  },
              }
    const renderCell = (row: TableRow, columnId: string): ReactNode => {
        const cell = cellOf(columns, row, columnId)
        return cell.isBadge ? <Badge tone="neutral">{cell.text}</Badge> : cell.text
    }
    return (
        <SlotView
            slot={rows}
            labels={labels}
            placeholder={tablePlaceholder(columns.length)}
            onRetry={read.retry}
            {...clearSearch}
            render={(items, isLoading) => (
                <Stack gap="row">
                    <DataTable
                        label={words(props.props.label)}
                        columns={columns.map((column, index) => ({
                            id: columnIdOf(index),
                            label: words(column.term),
                            isRowHeader: index === 0,
                            align: alignOf(column),
                            priority: column.priority ?? "high",
                        }))}
                        rows={items}
                        renderCell={renderCell}
                        isLoading={isLoading}
                        emptyContent={<EmptyNotice message={labels.empty} />}
                        {...(open.isAllowed ? { onRowAction: openRow } : {})}
                        {...(selectParam === undefined
                            ? {}
                            : {
                                  selectionMode: "single" as const,
                                  selectedIds: selectedIdsOf(props.params.value(selectParam)),
                                  onSelectionChange: (ids: ReadonlyArray<string> | "all") =>
                                      props.params.set(selectParam, chosenIdOf(ids)),
                              })}
                    />
                    {read.page === null || isLoading ? null : (
                        <MoreRows page={read.page} loadMoreLabel={words({ key: "tableLoadMore" })} labels={labels} />
                    )}
                </Stack>
            )}
        />
    )
}
