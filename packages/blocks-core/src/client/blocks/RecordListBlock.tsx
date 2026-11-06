import type { ReactNode } from "react"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { recordListBlock } from "../../blocks/record-list.block"
import { RECORD_ROWS_PLACEHOLDER, recordsView, rowsOf } from "../../rows/rows"
import { offerFor, offersOf } from "../../rows/row-actions"
import type { RowActionSlot } from "../../rows/row-actions"
import { queryOf } from "../../rows/search"
import { relabeller } from "../../rows/value-labels"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { RecordCardList } from "../composites/RecordCardList"
import { SelectableRows } from "../composites/SelectableRows"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** Bound records as a card with a command pill on each row, or as a selectable list that writes the chosen row to a param. */
export const RecordListBlock = (props: RenderOf<typeof recordListBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const { searchParam, selectParam } = props.props
    const searched = searchParam === undefined ? null : queryOf(props.params.value(searchParam))
    const labels = useSlotLabels(
        searched === null ? props.props.empty : (props.props.emptySearch ?? { key: "listSearchEmpty" }),
    )
    const read = props.slots.rows
    const open = props.slots.open
    const boundAction = (slot: RowActionSlot): ActionHandle => props.slots[slot]
    const offers = offersOf(props.props.actions ?? [], boundAction, open, words)
    const rows = derivedSlot(parsedSlot(read.slot, recordsView), (records) =>
        rowsOf(records, props.props, relabeller(props.props.labels, words), words({ key: "rowUntitled" })),
    )
    const runRow = (handle: ActionHandle, id: string): void => {
        handle
            .run({ id })
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
    return (
        <SlotView
            slot={rows}
            labels={labels}
            placeholder={RECORD_ROWS_PLACEHOLDER}
            onRetry={read.retry}
            {...clearSearch}
            render={(items, isLoading) =>
                selectParam === undefined ? (
                    <RecordCardList
                        title={words(props.props.label)}
                        rows={items}
                        empty={labels.empty}
                        isLoading={isLoading}
                        hasAvatar={props.props.avatar === true}
                        commandOf={(row) => {
                            const offer = offerFor(offers, row.action)
                            if (offer === null) return null
                            const handle = offer.slot === "open" ? open : boundAction(offer.slot)
                            return { label: offer.label, look: offer.look, press: () => runRow(handle, row.id) }
                        }}
                    />
                ) : (
                    <SelectableRows
                        rows={items}
                        selected={props.params.value(selectParam)}
                        isLoading={isLoading}
                        hasAvatar={props.props.avatar === true}
                        page={read.page}
                        onChoose={(id) => props.params.set(selectParam, id)}
                        words={{
                            label: words(props.props.label),
                            loadMore: words({ key: "listLoadMore" }),
                            loadFailed: words({ key: "listLoadFailed" }),
                            retry: labels.retry,
                        }}
                    />
                )
            }
        />
    )
}
