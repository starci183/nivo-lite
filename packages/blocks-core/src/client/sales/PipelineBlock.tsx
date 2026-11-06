import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { Board, EmptyNotice, Section, Stack, Text } from "@starci/grammar/common"
import type { BoardColumn, BoardMove } from "@starci/grammar/common"
import type { salesPipelineBlock } from "../../blocks/sales/pipeline.block"
import { announceOf, boardColumnsOf } from "../../rows/board-rows"
import type { BoardColumnSpec, BoardMoves } from "../../rows/board-rows"
import { cellContextOf, formatValue } from "../../rows/cell-format"
import type { CellContext } from "../../rows/cell-format"
import { countedWords } from "../../rows/counted-words"
import { countsView } from "../../rows/filter-tabs"
import type { TabCounts } from "../../rows/filter-tabs"
import { recordsView } from "../../rows/rows"
import { queryOf } from "../../rows/search"
import {
    PIPELINE_WORD_KEYS,
    columnCountOf,
    pipelineCardsOf,
    pipelineStagesOf,
    stageKeyOf,
} from "../../rules/sales/pipeline"
import type { PipelineCard, PipelineFormats, PipelineWords } from "../../rules/sales/pipeline"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { PaneSearch } from "../composites/PaneSearch"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import { useBoardMoves } from "../composites/useBoardMoves"
import type { RenderOf } from "../render-props"

type Props = RenderOf<typeof salesPipelineBlock>

/** The cards the board draws while the first read loads: none, so every column draws its own placeholder rows. */
const NO_CARDS: ReadonlyArray<PipelineCard> = []

/** The words a card of the pipeline is drawn with. */
const pipelineWordsOf = (word: (key: string) => string): PipelineWords => ({
    order: word(PIPELINE_WORD_KEYS.order),
    quote: word(PIPELINE_WORD_KEYS.quote),
    next: word(PIPELINE_WORD_KEYS.next),
    due: word(PIPELINE_WORD_KEYS.due),
    owner: word(PIPELINE_WORD_KEYS.owner),
    reason: word(PIPELINE_WORD_KEYS.reason),
})

/** How a card formats an amount and a day for the viewer. */
const pipelineFormatsOf = (context: CellContext): PipelineFormats => ({
    money: (value) => formatValue(value, "money", context),
    day: (value) => formatValue(value, "day", context),
})

/** What the board of the pipeline is given. */
interface PipelineBoardProps {
    readonly items: ReadonlyArray<PipelineCard>
    readonly isLoading: boolean
    readonly specs: ReadonlyArray<BoardColumnSpec>
    /** The cards a person moved that the read has not confirmed yet. */
    readonly moved: BoardMoves
    /** The counts of every stage, when known. */
    readonly known: TabCounts | null
    /** True while more cards wait on later pages. */
    readonly hasMore: boolean
    /** Opens the customer of a card. */
    readonly onOpen: (id: string) => void
    /** Moves a card to another stage; null when the person may not move cards. */
    readonly onMove: ((request: BoardMove) => void) | null
    /** The name of the board. */
    readonly label: string
    /** The words of a column with no card. */
    readonly emptyColumn: string
}

/** The columns of the stages with their cards, the keyboard moves and the notice of an empty column. */
const PipelineBoard = (props: PipelineBoardProps): ReactNode => {
    const words = useBlockWords()
    const word = (key: string): string => words({ key })
    const columns = boardColumnsOf(props.items, props.specs, props.moved, props.hasMore).map((column): BoardColumn => {
        const count = columnCountOf(props.known, column.value, column.cards.length, props.hasMore)
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
                onPress: () => props.onOpen(card.id),
            })),
            empty: <EmptyNotice message={props.emptyColumn} />,
        }
    })
    return (
        <Board
            label={props.label}
            isLoading={props.isLoading}
            scrollPreviousLabel={word("boardScrollPrevious")}
            scrollNextLabel={word("boardScrollNext")}
            columns={columns}
            {...(props.onMove === null
                ? {}
                : {
                      onMove: props.onMove,
                      moveLabels: {
                          instructions: word("boardMoveInstructions"),
                          announce: (item: string, column: string) =>
                              announceOf(word("boardMoveAnnounce"), item, column),
                      },
                  })}
        />
    )
}

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
    const cards = derivedSlot(parsedSlot(props.slots.rows.slot, recordsView), (records) => {
        const list = pipelineCardsOf(records, pipelineWordsOf(word), pipelineFormatsOf(context))
        return list.length === 0 ? null : list
    })
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
    return (
        <Section
            title={words(props.props.label)}
            headingLevel={3}
            {...(known === null ? {} : { fact: countedWords(words(props.props.countLabel), known.total) })}
        >
            <Stack gap="row">
                <PaneSearch
                    param={props.props.searchParam}
                    params={props.params}
                    label={words(props.props.searchLabel)}
                    clearLabel={word("searchClear")}
                />
                <SlotView
                    slot={cards}
                    labels={labels}
                    placeholder={NO_CARDS}
                    onRetry={props.slots.rows.retry}
                    {...clearSearch}
                    render={(items, isLoading) => (
                        <PipelineBoard
                            items={items}
                            isLoading={isLoading}
                            specs={specs}
                            moved={mover.moved}
                            known={known}
                            hasMore={props.slots.rows.page?.hasMore === true}
                            onOpen={(id) => props.params.set(props.props.selectParam, id)}
                            onMove={props.slots.move.isAllowed ? moveCard : null}
                            label={words(props.props.label)}
                            emptyColumn={words(props.props.emptyColumn)}
                        />
                    )}
                />
            </Stack>
        </Section>
    )
}
