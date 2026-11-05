import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { Board, EmptyNotice } from "@starci/grammar/common"
import type { BoardColumn, BoardMove } from "@starci/grammar/common"
import type { boardBlock } from "../../blocks/board.block"
import { announceOf, boardCardsOf, boardColumnsOf, BOARD_PLACEHOLDER } from "../../rows/board-rows"
import type { BoardCard, BoardColumnSpec } from "../../rows/board-rows"
import { recordsView } from "../../rows/rows"
import { queryOf } from "../../rows/search"
import { relabeller } from "../../rows/value-labels"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { useBoardMoves } from "../composites/useBoardMoves"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** The row the Grammar board draws for one card: its title, its line, its mark and its short fact. */
const rowOf = (card: BoardCard, onPress: (() => void) | undefined): BoardColumn["items"][number] => ({
    id: card.id,
    title: card.title,
    ...(card.description === "" ? {} : { description: card.description }),
    ...(card.badge === "" ? {} : { badges: [{ label: card.badge, tone: "neutral" as const }] as const }),
    ...(card.meta === "" ? {} : { meta: { text: card.meta } }),
    ...(onPress === undefined ? {} : { onPress }),
})

/**
 * Records in the columns a field's declared values name. A card moves by drag or by keyboard: it shows in its new column at once,
 * the `move` action runs, and a refusal puts it back. The moves the read has not caught up with are kept until it does.
 */
export const BoardBlock = (props: RenderOf<typeof boardBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const { searchParam, selectParam, columns: declared } = props.props
    const searched = searchParam === undefined ? null : queryOf(props.params.value(searchParam))
    const labels = useSlotLabels(
        searched === null ? props.props.emptyColumn : (props.props.emptySearch ?? { key: "listSearchEmpty" }),
    )
    const read = props.slots.rows
    const move = props.slots.move
    const cards = derivedSlot(parsedSlot(read.slot, recordsView), (records) =>
        boardCardsOf(records, props.props, relabeller(props.props.labels, words)),
    )
    const known = "items" in cards ? cards.items : null
    const mover = useBoardMoves(move, known, () => host.notify("danger", words({ key: "boardMoveFailed" })))
    const specs: ReadonlyArray<BoardColumnSpec> = declared.map((item) => ({
        value: item.value,
        label: words(item.label),
    }))
    const moveCard = (request: BoardMove): void => {
        if (request.fromColumnId !== request.toColumnId) mover.moveCard(request.itemId, request.toColumnId)
    }
    const press = (id: string): (() => void) | undefined =>
        selectParam === undefined ? undefined : () => props.params.set(selectParam, id)
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
            slot={cards}
            labels={labels}
            placeholder={BOARD_PLACEHOLDER}
            onRetry={read.retry}
            {...clearSearch}
            render={(items, isLoading) => (
                <Board
                    label={words(props.props.label)}
                    isLoading={isLoading}
                    scrollPreviousLabel={words({ key: "boardScrollPrevious" })}
                    scrollNextLabel={words({ key: "boardScrollNext" })}
                    columns={boardColumnsOf(items, specs, mover.moved, read.page?.hasMore === true).map((column) => ({
                        id: column.value,
                        title: column.label,
                        ...(column.count === undefined ? {} : { count: column.count }),
                        items: column.cards.map((card) => rowOf(card, press(card.id))),
                        empty: <EmptyNotice message={words(props.props.emptyColumn)} />,
                    }))}
                    {...(move.isAllowed
                        ? {
                              onMove: moveCard,
                              moveLabels: {
                                  instructions: words({ key: "boardMoveInstructions" }),
                                  announce: (item: string, column: string) =>
                                      announceOf(words({ key: "boardMoveAnnounce" }), item, column),
                              },
                          }
                        : {})}
                />
            )}
        />
    )
}
