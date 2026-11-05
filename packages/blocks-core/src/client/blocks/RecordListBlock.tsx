import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { BadgeData } from "@starci/grammar/common"
import type { recordListBlock } from "../../blocks/record-list.block"
import { RECORD_ROWS_PLACEHOLDER, recordsView, rowsOf } from "../../rows/rows"
import type { RecordRow } from "../../rows/rows"
import { queryOf } from "../../rows/search"
import { relabeller } from "../../rows/value-labels"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { SelectableRows } from "../composites/SelectableRows"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** The marks of a row for the card list: its badge and its first further chip, at most two. */
const badgesOf = (row: RecordRow): { readonly badges?: readonly [BadgeData] | readonly [BadgeData, BadgeData] } => {
    const [first, second] = [row.badge, ...row.chips].filter((label) => label !== "")
    if (first === undefined) return {}
    const head: BadgeData = { label: first, tone: "neutral" }
    return second === undefined ? { badges: [head] } : { badges: [head, { label: second, tone: "neutral" }] }
}

/** Bound records as a card with an action on each row, or as a selectable list that writes the chosen row to a param. */
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
    const rows = derivedSlot(parsedSlot(read.slot, recordsView), (records) =>
        rowsOf(records, props.props, relabeller(props.props.labels, words)),
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
    return (
        <SlotView
            slot={rows}
            labels={labels}
            placeholder={RECORD_ROWS_PLACEHOLDER}
            onRetry={read.retry}
            {...clearSearch}
            render={(items, isLoading) =>
                selectParam === undefined ? (
                    <SurfaceCard
                        kind="list"
                        label={words(props.props.label)}
                        headingLevel={2}
                        isLoading={isLoading}
                        items={items.map((row) => ({
                            id: row.id,
                            title: row.title,
                            description: row.description,
                            ...badgesOf(row),
                            ...(open.isAllowed ? { action: { label: open.label, press: () => openRow(row.id) } } : {}),
                        }))}
                        empty={<EmptyNotice message={labels.empty} />}
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
