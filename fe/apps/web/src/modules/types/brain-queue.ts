import type { DataSlot, SlotLabels } from "./slot"
import type { PaneGridLayout } from "./panes"

/** The tone of a badge of the queue. */
type QueueTone = "danger" | "warning" | "accent" | "muted" | "success" | "neutral"

/** Words taken from a document, with the document they come from. */
export interface QueueQuoteView {
    readonly id: string
    readonly source: string
    readonly byline: string | undefined
    readonly text: string
}

/** The glyph a row of the queue wears: what kind of work it is. */
export type QueueGlyph = "contradiction" | "fact" | "missing" | "expired" | "ask" | "proposal" | "other"

/** One command of an opened item: a destination or a command, with its pending state. */
export interface QueueActionView {
    readonly id: string
    /** The part of the item the command is about (one value among several); absent for the item itself. */
    readonly partId?: string
    readonly label: string
    readonly intent: "neutral" | "alternative" | "dismiss"
    readonly href: string | null
    readonly isPending: boolean
}

/** One value laid beside the others: the value in force, or a proposed one. */
export interface QueueTileView {
    readonly id: string
    /** What the tile is ("In force", "Proposed"); absent when it adds nothing. */
    readonly label: string | null
    readonly title: string
    readonly lines: ReadonlyArray<string>
    /** The value the decision is about. */
    readonly isHighlighted: boolean
    readonly actions: ReadonlyArray<QueueActionView>
}

/** What the opened item draws in the main pane under its head. */
export interface QueueDetailView {
    /** The question the item asks the owner ("Which document is right?"); absent for an item that asks none. */
    readonly heading: string | null
    readonly body: string | null
    readonly lines: ReadonlyArray<string>
    readonly quotes: ReadonlyArray<QueueQuoteView>
    readonly tiles: ReadonlyArray<QueueTileView>
    /** What is in use now, in a quiet notice; null when the item has no such fact. */
    readonly notice: { readonly title: string; readonly description: string } | null
    /** The commands that answer the item, side by side. */
    readonly actions: ReadonlyArray<QueueActionView>
    /** The commands that are rarely used: the item's menu. */
    readonly menu: ReadonlyArray<QueueActionView>
    readonly footnote: string | null
}

/** What the side pane says about the opened item. */
export interface QueueAsideView {
    readonly title: string
    readonly terms: ReadonlyArray<{ readonly id: string; readonly term: string; readonly text: string }>
    readonly quotes: ReadonlyArray<QueueQuoteView>
    readonly quotesTitle: string
    readonly action: { readonly label: string; readonly href: string } | null
}

/** Where a command of an item goes: the list it came from decides who runs it. */
export type QueueSource = "finding" | "review" | "gaps" | "proposals"

/** One item of the queue of what needs the owner. */
export interface QueueEntryView {
    readonly id: string
    readonly source: QueueSource
    /** The id the source knows the item by. */
    readonly rawId: string
    readonly filter: string
    readonly glyph: QueueGlyph
    readonly title: string
    readonly line: string
    readonly badge: { readonly label: string; readonly tone: QueueTone }
    readonly head: { readonly title: string; readonly description: string }
    readonly detail: QueueDetailView
    readonly aside: QueueAsideView | null
}

/** One filter chip of the queue: its label already carries its count. */
export interface QueueFilterView {
    readonly id: string
    readonly label: string
}

/** What the queue draws: the entries as one slot, the controls over it, and the opened item. */
export interface QueueView {
    /** The entries after the filter and the search; the slot carries the loading, failed and empty states of the whole queue. */
    readonly slot: DataSlot<ReadonlyArray<QueueEntryView>>
    /** Some entries exist but the filter and the search keep none. */
    readonly isFiltered: boolean
    readonly slotLabels: SlotLabels
    readonly filters: ReadonlyArray<QueueFilterView>
    readonly filter: string
    readonly query: string
    readonly selectedId: string | null
    readonly grid: PaneGridLayout
    /** A list of the queue could not be read while the others were: the words of the failure; null when none failed. */
    readonly partialFailure: string | null
    readonly hasNextPage: boolean
}
