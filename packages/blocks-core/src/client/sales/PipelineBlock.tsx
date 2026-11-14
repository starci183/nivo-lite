import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { ReadHandle } from "@nivo-lite/agent-sdk/block"
import {
    Board,
    EmptyNotice,
    Section,
    SurfaceCard,
    Text,
    type BoardColumn,
    type BoardMove,
} from "@starci/grammar/common"
import type { salesPipelineBlock } from "../../blocks/sales/pipeline.block"
import { announceOf, boardColumnsOf, type BoardColumnView } from "../../rows/board-rows"
import { cellContextOf, formatValue, type CellContext } from "../../rows/cell-format"
import { countsView, type TabCounts } from "../../rows/filter-tabs"
import { paneHeadersOf } from "../../rows/pane-headers"
import { recordsView } from "../../rows/rows"
import { queryOf } from "../../rows/search"
import {
    PIPELINE_WORD_KEYS,
    columnCountOf,
    pipelineCardsOf,
    pipelineStagesOf,
    stageKeyOf,
    type PipelineCard,
} from "../../rules/sales/pipeline"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { usePaneSearch } from "../composites/usePaneSearch"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import { useBoardMoves } from "../composites/useBoardMoves"
import type { RenderOf } from "../render-props"

type Props = RenderOf<typeof salesPipelineBlock>

/** The cards the board draws while the first read loads: none, so every column draws its own placeholder rows. */
const NO_CARDS: ReadonlyArray<PipelineCard> = []

/** The column the board draws for one stage: its count, a card for each deal that opens it, and the words of an empty column. */
const columnOf = (
    column: BoardColumnView<PipelineCard>,
    known: TabCounts | null,
    props: Props,
    emptyText: string,
): BoardColumn => {
    const hasMore = props.slots.rows.page?.hasMore === true
    const count = columnCountOf(known, column.value, column.cards.length, hasMore)
    return {
        id: column.value,
        title: column.label,
        ...(count === undefined ? {} : { count }),
        items: column.cards.map((card) => ({
            id: card.id,
            title: card.title,
            ...(card.description === "" ? {} : { description: card.description }),
            ...(card.meta === "" ? {} : { meta: { text: card.meta } }),
            ...(card.detail === ""
                ? {}
                : {
                      detail: (
                          <Text size="sm" tone="muted">
                              {card.detail}
                          </Text>
                      ),
                  }),
            onPress: () => props.params.set(props.props.selectParam, card.id),
        })),
        empty: <EmptyNotice message={emptyText} />,
    }
}

/** The deals the read answers as cards, with the words of their lines; none when the read has no deal. */
const cardsSlotOf = (slot: ReadHandle["slot"], word: (key: string) => string, context: CellContext) =>
    derivedSlot(parsedSlot(slot, recordsView), (records) => {
        const list = pipelineCardsOf(
            records,
            {
                order: word(PIPELINE_WORD_KEYS.order),
                quote: word(PIPELINE_WORD_KEYS.quote),
                next: word(PIPELINE_WORD_KEYS.next),
                due: word(PIPELINE_WORD_KEYS.due),
                owner: word(PIPELINE_WORD_KEYS.owner),
                reason: word(PIPELINE_WORD_KEYS.reason),
            },
            {
                money: (value) => formatValue(value, "money", context),
                day: (value) => formatValue(value, "day", context),
            },
        )
        return list.length === 0 ? null : list
    })

/** The Sales pipeline: a column for each stage of the deals, each card a customer with what the deal is and where it stands. */
export const PipelineBlock = (props: Props): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const word = (key: string): string => words({ key })
    const context = cellContextOf(host.locale(), undefined)
    const searched = queryOf(props.params.value(props.props.searchParam))
    const labels = useSlotLabels(
        searched === null ? props.props.emptyColumn : (props.props.emptySearch ?? { key: "listSearchEmpty" }),
    )
    const cards = cardsSlotOf(props.slots.rows.slot, word, context)
    const counts = parsedSlot(props.slots.counts.slot, countsView)
    const known = "items" in counts ? counts.items : null
    const loaded = "items" in cards ? cards.items : null
    const mover = useBoardMoves(props.slots.move, loaded, () => host.notify("danger", word("boardMoveFailed")))
    const stages = pipelineStagesOf(props.props.stages)
    const specs = stages.map((stage) => ({ value: stage, label: word(stageKeyOf(stage)) }))
    const moveCard = (request: BoardMove): void => {
        if (request.fromColumnId !== request.toColumnId) mover.moveCard(request.itemId, request.toColumnId)
    }
    const clearSearch =
        searched === null
            ? {}
            : {
                  emptyAction: {
                      label: word("searchClear"),
                      onAction: () => props.params.set(props.props.searchParam, null),
                  },
              }
    const search = usePaneSearch(props.params, props.props.searchParam, {
        label: words(props.props.searchLabel),
        clearLabel: word("searchClear"),
    })
    const headers = paneHeadersOf(null, search)
    return (
        <Section title={words(props.props.label)} headingLevel={3} {...(known === null ? {} : { count: known.total })}>
            <SlotView
                slot={cards}
                frame={(notice) => <SurfaceCard headers={headers}>{notice}</SurfaceCard>}
                labels={labels}
                placeholder={NO_CARDS}
                onRetry={props.slots.rows.retry}
                {...clearSearch}
                render={(items, isLoading) => (
                    <Board
                        headers={headers}
                        label={words(props.props.label)}
                        isLoading={isLoading}
                        scrollPreviousLabel={word("boardScrollPrevious")}
                        scrollNextLabel={word("boardScrollNext")}
                        columns={boardColumnsOf(items, specs, mover.moved, props.slots.rows.page?.hasMore === true).map(
                            (column) => columnOf(column, known, props, words(props.props.emptyColumn)),
                        )}
                        {...(props.slots.move.isAllowed
                            ? {
                                  onMove: moveCard,
                                  moveLabels: {
                                      instructions: word("boardMoveInstructions"),
                                      announce: (item: string, column: string) =>
                                          announceOf(word("boardMoveAnnounce"), item, column),
                                  },
                              }
                            : {})}
                    />
                )}
            />
        </Section>
    )
}
