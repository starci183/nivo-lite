import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { SurfaceCard } from "@starci/grammar/common"
import { surfaceFrame } from "../composites/surfaceFrame"
import type { recordListBlock } from "../../blocks/record-list.block"
import { RECORD_ROWS_PLACEHOLDER, recordsView, rowsOf } from "../../rows/rows"
import { queryOf } from "../../rows/search"
import { relabeller } from "../../rows/value-labels"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { useInCard } from "../composites/CardScope"
import { RecordCardList } from "../composites/RecordCardList"
import { SelectableRows } from "../composites/SelectableRows"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** What the frame of a selectable list is given. */
interface FramedProps {
    readonly isCard: boolean
    readonly label: string
    readonly children: ReactNode
}

/** What a selectable list is drawn in: its own rows, or the one surface card that holds them. */
const Framed = (props: FramedProps): ReactNode =>
    props.isCard ? (
        <SurfaceCard label={props.label} headingLevel={3}>
            {props.children}
        </SurfaceCard>
    ) : (
        props.children
    )

/** The action that clears the search an empty list answers with; none when nothing is searched. */
const clearSearchOf = (
    searched: string | null,
    clear: () => void,
    label: string,
): Partial<{ emptyAction: { label: string; onAction: () => void } }> =>
    searched === null ? {} : { emptyAction: { label, onAction: clear } }

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
        rowsOf(records, props.props, relabeller(props.props.labels, words), words({ key: "rowUntitled" })),
    )
    const openRow = (id: string): void => {
        open.run({ id })
            .then((outcome) => {
                if (!outcome.ok) host.notify("danger", labels.error)
            })
            .catch(() => host.notify("danger", labels.error))
    }
    const clearSearch = clearSearchOf(
        searched,
        () => props.params.set(searchParam ?? "", null),
        words({ key: "searchClear" }),
    )
    const inSurface = useInCard()
    const isCard = props.props.surface === "card" && !inSurface
    const label = words(props.props.label)
    const list = (
        <SlotView
            slot={rows}
            labels={labels}
            placeholder={RECORD_ROWS_PLACEHOLDER}
            onRetry={read.retry}
            {...(isCard ? { frame: surfaceFrame({ label, headingLevel: 3 }) } : {})}
            {...clearSearch}
            render={(items, isLoading) =>
                selectParam === undefined ? (
                    <RecordCardList
                        isHeadless={inSurface}
                        title={words(props.props.label)}
                        rows={items}
                        empty={labels.empty}
                        isLoading={isLoading}
                        hasAvatar={props.props.avatar === true}
                        isCard={isCard}
                        action={open.isAllowed ? { label: open.label, press: openRow } : null}
                    />
                ) : (
                    <Framed isCard={isCard} label={label}>
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
                    </Framed>
                )
            }
        />
    )
    return list
}
