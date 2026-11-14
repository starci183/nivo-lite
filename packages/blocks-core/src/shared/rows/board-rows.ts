import { textOf, valueAt } from "../slots/paths"
import type { Relabel } from "./value-labels"

/** The paths of a record that name the parts of its card, and the field its column comes from. */
export interface BoardPaths {
    /** The path of the text that identifies the record. */
    readonly idPath: string
    /** The path of the text that heads the card. */
    readonly titlePath: string
    /** The path of the field whose value says which column the card is in. */
    readonly groupBy: string
    /** The path of the line under the headline; absent draws none. */
    readonly descriptionPath?: string | undefined
    /** The path of the text of the badge; absent draws none. */
    readonly badgePath?: string | undefined
    /** The path of the short fact at the end of the card; absent draws none. */
    readonly metaPath?: string | undefined
}

/** One card of a board: a record, in the column its field names. */
export interface BoardCard {
    /** The key of the record. */
    readonly id: string
    /** The headline of the card. */
    readonly title: string
    /** The line under the headline; empty draws none. */
    readonly description: string
    /** The words of the mark on the card; empty draws none. */
    readonly badge: string
    /** The short fact on the card; empty draws none. */
    readonly meta: string
    /** The value of the grouping field: the column the read puts the card in. */
    readonly column: string
}

/** One column a spec declares: the value of the grouping field and its words in the viewer's language. */
export interface BoardColumnSpec {
    /** The value of the grouping field the column holds. */
    readonly value: string
    /** The words on the column head. */
    readonly label: string
}

/** Where a card sits: its key and the column its record says. */
export interface Placed {
    /** The key of the record. */
    readonly id: string
    /** The value of the grouping field. */
    readonly column: string
}

/** One column as drawn: its cards, and how many it holds when every card is known. */
export interface BoardColumnView<C extends Placed = BoardCard> {
    /** The value of the grouping field the column holds. */
    readonly value: string
    /** The words on the column head. */
    readonly label: string
    /** The cards of the column, in the order of the read. */
    readonly cards: ReadonlyArray<C>
    /** How many cards the column holds; absent while more cards may still load. */
    readonly count: number | undefined
}

/** The pending moves of a board: the column each moved card is shown in, by card id. */
export type BoardMoves = Readonly<Record<string, string>>

/** The cards a skeleton draws: none, so every column draws its own placeholder rows. */
export const BOARD_PLACEHOLDER: ReadonlyArray<BoardCard> = []

/** The text at an optional path of a record, in the words the labels give it; nothing without a path. */
const textAt = (record: unknown, path: string | undefined, relabel: Relabel): string =>
    path === undefined ? "" : relabel(path, textOf(valueAt(record, path)))

/** The card of one record; a record without a text id draws no card. */
const cardOf = (record: unknown, paths: BoardPaths, relabel: Relabel): ReadonlyArray<BoardCard> => {
    const id = textOf(valueAt(record, paths.idPath))
    if (id === "") return []
    return [
        {
            id,
            title: relabel(paths.titlePath, textOf(valueAt(record, paths.titlePath))),
            description: textAt(record, paths.descriptionPath, relabel),
            badge: textAt(record, paths.badgePath, relabel),
            meta: textAt(record, paths.metaPath, relabel),
            column: textOf(valueAt(record, paths.groupBy)),
        },
    ]
}

/** The cards of a bound list, or null when none can be drawn, which the block reads as an empty slot. */
export const boardCardsOf = (
    records: ReadonlyArray<unknown>,
    paths: BoardPaths,
    relabel: Relabel,
): ReadonlyArray<BoardCard> | null => {
    const cards = records.flatMap((record) => cardOf(record, paths, relabel))
    return cards.length === 0 ? null : cards
}

/** The columns of a board: one per declared value, each with the cards that are in it now (a pending move counts). */
export const boardColumnsOf = <C extends Placed>(
    cards: ReadonlyArray<C>,
    specs: ReadonlyArray<BoardColumnSpec>,
    moved: BoardMoves,
    hasMore: boolean,
): ReadonlyArray<BoardColumnView<C>> =>
    specs.map((spec) => {
        const inColumn = cards.filter((card) => (moved[card.id] ?? card.column) === spec.value)
        return { value: spec.value, label: spec.label, cards: inColumn, count: hasMore ? undefined : inColumn.length }
    })

/** The pending moves with one more: the card is shown in the column at once. */
export const withMove = (moved: BoardMoves, id: string, column: string): BoardMoves => ({ ...moved, [id]: column })

/** The pending moves without the card's: it returns to the column the read puts it in (a move the host refused). */
export const withoutMove = (moved: BoardMoves, id: string): BoardMoves =>
    Object.fromEntries(Object.entries(moved).filter(([key]) => key !== id))

/** The pending moves the read has not caught up with: a move whose card the read now puts in the same column is settled. */
export const unsettledMoves = (moved: BoardMoves, cards: ReadonlyArray<Placed>): BoardMoves =>
    Object.fromEntries(
        Object.entries(moved).filter(([id, column]) => cards.some((card) => card.id === id && card.column !== column)),
    )

/** The words of the keyboard announcement: the message with its `{item}` and `{column}` replaced. */
export const announceOf = (template: string, item: string, column: string): string =>
    template.replaceAll("{item}", item).replaceAll("{column}", column)
