import type { BrainPageHeaderView } from "./brain-page"
import type { PaneGridLayout } from "./panes"
import type { DataSlot, SlotLabels } from "./slot"

/** The filters of the documents list: every document, the ones a worker is on, the failed ones, and the base knowledge of NIVO (read only). */
export type DocTabId = "all" | "active" | "failed" | "nivo"

/** What the address opens in the middle pane: nothing, a document (its id is not known while the page only draws its skeleton) or the base knowledge. */
export type DocsSelection =
    { readonly kind: "none" } | { readonly kind: "doc"; readonly id: string | undefined } | { readonly kind: "nivo" }

/** The mark of a row: what the document is (a file, a note, a Q&A list, a link) or the base knowledge of NIVO. */
export type DocGlyph = "file" | "text" | "faq" | "url" | "nivo" | "public" | "search"

/** A small settled word on a row or a head: where a document stands, who may read it. */
export interface DocChipView {
    readonly label: string
    readonly tone: "neutral" | "warning" | "success" | "danger" | "accent"
}

/** One row of the list pane: its mark, its name, one line under it and where it stands. */
export interface DocRowView {
    readonly id: string
    readonly title: string
    readonly line: string
    readonly glyph: DocGlyph
    readonly chip: DocChipView | null
}

/** One term and its value of the details pane. */
export interface DocFactView {
    readonly id: string
    readonly term: string
    readonly text: string
}

/** One command of the "..." menu of an opened document. */
export interface DocMenuItemView {
    readonly id: string
    readonly label: string
    readonly tone?: "danger"
}

/** The head band over an opened document or an opened item of the base knowledge. */
export interface DocHeadView {
    readonly title: string
    readonly meta: string
    readonly glyph: DocGlyph
    readonly chips: ReadonlyArray<DocChipView>
    /** The command that reads the document again; null where nothing can be read again (the base knowledge, a reader who may not write). */
    readonly reindex: { readonly label: string; readonly isPending: boolean; readonly isDisabled: boolean } | null
    readonly menu: ReadonlyArray<DocMenuItemView>
    /** The confirmation of the delete command; null where the document cannot be deleted. */
    readonly remove: {
        readonly title: string
        readonly description: string
        readonly confirmLabel: string
        readonly cancelLabel: string
        readonly isPending: boolean
    } | null
}

/** The body of an opened document: why it failed, how far a worker is, its passages and its text. */
export interface DocBodyView {
    readonly note: { readonly text: string; readonly tone: "negative" | "cautionary" } | null
    /** The ingest stage a worker is on and the steps; null when no worker is on the document. */
    readonly stage: {
        readonly label: string
        readonly steps: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly currentId: string
    } | null
    readonly passages: {
        readonly title: string
        readonly count: string
        readonly hint: string
        readonly rows: ReadonlyArray<{
            readonly id: string
            readonly text: string
            readonly chip: string
        }>
        readonly emptyLabel: string
    }
    readonly content: { readonly title: string; readonly text: string }
}

/** The body of an opened item of the base knowledge: the read-only notice and the numbered lines. */
export interface NivoBodyView {
    readonly noticeTitle: string
    readonly noticeBody: string
    readonly contentTitle: string
    readonly lines: ReadonlyArray<string>
}

/** One idea of the suggestions list ("worth adding"). */
export interface DocIdeaView {
    readonly id: string
    readonly title: string
    readonly line: string
    readonly addHref: string
    readonly isPending: boolean
    readonly menu: ReadonlyArray<DocMenuItemView>
}

/** The suggestions of the side pane: the ideas, the ones set aside and the words around them. */
export interface DocIdeasView {
    readonly title: string
    readonly hint: string
    readonly addLabel: string
    readonly menuLabel: string
    readonly open: ReadonlyArray<DocIdeaView>
    readonly skipped: ReadonlyArray<DocIdeaView & { readonly state: string }>
    readonly skippedTitle: string
    readonly moreLabel: string | null
    readonly emptyLabel: string
}

/** One opened item as its read carries it: the head band, the body and the facts of the side pane. */
export interface DocOpenedView<Body> {
    readonly head: DocHeadView
    readonly body: Body
    readonly facts: ReadonlyArray<DocFactView>
}

/** The words of the panes that belong to no data. */
export interface DocsCopy {
    readonly grid: string
    readonly listLabel: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearSearch: string
    readonly tabsLabel: string
    readonly moduleLabel: string
    readonly modulePlaceholder: string
    readonly moreFilters: (count: number) => string
    /** The word on the control that folds the tabs that do not fit. */
    readonly moreWord: string
    readonly back: string
    readonly moreActions: string
    readonly asideTitle: string
    readonly closeAside: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly clearFilters: string
    readonly emptyBody: string
    readonly emptyAction: string
    readonly errorBody: string
}

/** The words every list pane of the Second Brain shares; the agent choice has none where the list has no such choice. */
export type DocListCopy = Pick<
    DocsCopy,
    | "listLabel"
    | "searchLabel"
    | "searchPlaceholder"
    | "clearSearch"
    | "tabsLabel"
    | "moreFilters"
    | "moreWord"
    | "noMatchTitle"
    | "noMatchBody"
    | "clearFilters"
    | "emptyBody"
    | "emptyAction"
    | "errorBody"
> &
    Partial<Pick<DocsCopy, "moduleLabel" | "modulePlaceholder">>

/** One tab of the filter row: its words and how many rows it holds. */
export interface DocTabView {
    readonly id: DocTabId
    readonly label: string
    readonly count: number | undefined
}

/** One tab of any list pane of the Second Brain: its words and how many rows it holds. */
export interface DocListTabView {
    readonly id: string
    readonly label: string
    readonly count: number | undefined
}

/** What every list pane of the Second Brain (documents, public documents) draws: the rows, the search, the filter tabs and the open row. */
export interface DocListFace {
    readonly slot: DataSlot<ReadonlyArray<DocRowView>>
    readonly slotLabels: SlotLabels
    readonly query: string
    readonly tab: string
    readonly tabs: ReadonlyArray<DocListTabView>
    readonly selectedId: string | null
    /** The agent the rows are for, as a choice above the rows; absent where the list has no such choice. */
    readonly module?: string
    readonly moduleOptions?: ReadonlyArray<{ readonly id: string; readonly label: string }>
}

/** What the list pane of the documents draws and which row is open. */
export interface DocListView extends DocListFace {
    readonly tab: DocTabId
    readonly tabs: ReadonlyArray<DocTabView>
    readonly module: string
    readonly moduleOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly isFiltered: boolean
}

/** What the middle and side panes draw: nothing chosen yet, an opened document or an opened item of the base knowledge. */
export type DocMainView =
    | { readonly kind: "none" }
    | { readonly kind: "doc"; readonly slot: DataSlot<DocOpenedView<DocBodyView>> }
    | { readonly kind: "nivo"; readonly slot: DataSlot<DocOpenedView<NivoBodyView>> }

/** What the documents screen draws. */
export interface KnowledgeDocsView {
    readonly props: {
        readonly header: BrainPageHeaderView
        readonly copy: DocsCopy
        /** The arrangement of the panes: the one a phone shows, and whether the side pane is a column. */
        readonly grid: PaneGridLayout
        readonly list: DocListView
        readonly main: DocMainView
        readonly ideas: DocIdeasView | null
        /** The one line that sends the owner to the queue where the facts read from the documents wait; null while none waits. */
        readonly nextReview: { readonly label: string; readonly href: string } | null
        /** The link from the opened document to its questions ("Questions of the document (3)"); null while none are open. */
        readonly questions: { readonly label: string; readonly href: string } | null
        /** The page's first read has no data yet: every region draws its skeleton at once. */
        readonly isWaiting: boolean
        readonly hasAside: boolean
        readonly isRemoveOpen: boolean
        readonly canAdd: boolean
        readonly addHref: string
        readonly addLabel: string
    }
    readonly on: {
        readonly selectTab: (id: string) => void
        readonly select: (id: string) => void
        readonly search: (value: string) => void
        readonly setTab: (id: string) => void
        readonly setModule: (value: string | null) => void
        readonly clear: () => void
        readonly back: () => void
        readonly retry: () => void
        readonly add: () => void
        readonly reindex: () => void
        readonly menu: (id: string) => void
        readonly removeOpenChange: (isOpen: boolean) => void
        readonly remove: () => Promise<void>
        readonly closeAside: () => void
        readonly idea: (ideaId: string, menuId: string) => void
        readonly moreIdeas: () => void
    }
}
