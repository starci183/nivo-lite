import type { FactDrawerView } from "./brain-page"

/** A badge of the inbox and of the facts page: its words and its tone. */
export interface PickBadgeView {
    readonly label: string
    readonly tone: "success" | "warning" | "danger" | "neutral" | "muted" | "accent"
}

/** One row of a table of facts that can be ticked: one subject and attribute, its value, where it comes from and how far it is believed. */
export interface FactPickRowView {
    /** The key of the row (subject and attribute): what is ticked. */
    readonly id: string
    /** The fact the row opens. */
    readonly factId: string
    readonly title: string
    readonly source: string
    readonly value: string
    readonly badge: PickBadgeView
    /** The owner has to choose between values: the row cannot be ticked, it opens the comparison. */
    readonly isConflict: boolean
    /** Nothing waits on the row: it is in force, there is nothing to approve. */
    readonly isSettled: boolean
    readonly isSelected: boolean
}

/** Whether a group is ticked: every row that can be, some of them, or none. */
export type PickSelection = "all" | "some" | "none"

/** One group of rows: a document or a subject, with its tick, its words and whether it is open. */
export interface FactPickGroupView {
    readonly id: string
    readonly title: string
    readonly line: string
    readonly badges: ReadonlyArray<PickBadgeView>
    readonly isOpen: boolean
    readonly toggleLabel: string
    readonly selection: PickSelection
    /** Some row of the group can be ticked. */
    readonly isSelectable: boolean
    readonly rows: ReadonlyArray<FactPickRowView>
}

/** The words of a table of facts that can be ticked. */
export interface FactPickCopy {
    readonly label: string
    readonly columns: {
        readonly item: string
        readonly value: string
        readonly badge: string
        readonly action: string
    }
    readonly openLabel: string
    readonly compareLabel: string
    readonly emptyTitle: string
    readonly emptyBody: string
}

/** The bar at the top of the card: how many rows are ticked of how many can be, and the commands on them. */
export interface PickSelectionBarView {
    /** "Selected 25 / 60 · 2 documents"; empty while nothing is ticked, where `hint` speaks instead. */
    readonly summary: string
    /** How to tick, said once in muted small text on the card's switch zone. */
    readonly hint: string
    readonly count: number
    readonly clearLabel: string
    readonly rejectLabel: string
    readonly approveLabel: string
    readonly isPending: boolean
    /** The reader may not decide: the bar shows no command. */
    readonly canWrite: boolean
}

/** The question asked before the ticked rows are approved or rejected together. */
export interface PickConfirmView {
    readonly tone: "informative" | "negative"
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
}

/** One value the owner can choose in the comparison: its words, the quote and the documents behind it, its trust and its condition. */
export interface ConflictOptionView {
    readonly id: string
    readonly value: string
    readonly quote: string | null
    readonly sources: ReadonlyArray<string>
    readonly badges: ReadonlyArray<PickBadgeView>
    readonly condition: string | null
}

/** The comparison of the values of one subject and attribute, in a wide drawer. */
export interface ConflictDrawerView {
    readonly title: string
    readonly description: string
    readonly closeLabel: string
    readonly todayTitle: string
    readonly today: {
        readonly label: string
        readonly value: string | null
        readonly badge: PickBadgeView
        readonly note: string
    }
    readonly chooseTitle: string
    readonly options: ReadonlyArray<ConflictOptionView>
    readonly chosenId: string | null
    readonly readersTitle: string
    readonly readers: ReadonlyArray<{ readonly id: string; readonly name: string; readonly line: string }>
    readonly readersEmpty: string
    readonly footerNote: string
    readonly laterLabel: string
    readonly chooseLabel: string
    readonly isPending: boolean
    readonly canWrite: boolean
}

/** The detail of one fact in a drawer: its value, its quote, its terms, its history, and its commands in the canon order. */
export interface FactDrawerDetailView {
    readonly title: string
    readonly description: string
    readonly closeLabel: string
    readonly valueLabel: string
    readonly value: string
    readonly badges: ReadonlyArray<PickBadgeView>
    readonly quoteTitle: string
    readonly quote: { readonly text: string; readonly source: string } | null
    readonly terms: ReadonlyArray<{ readonly id: string; readonly term: string; readonly text: string }>
    readonly historyTitle: string
    readonly history: ReadonlyArray<{ readonly id: string; readonly value: string; readonly line: string }> | null
    /** Approve, the primary; null when nothing waits or the reader may not decide. */
    readonly approve: { readonly label: string; readonly isPending: boolean } | null
    readonly reject: { readonly label: string; readonly isPending: boolean } | null
    readonly edit: { readonly label: string } | null
    /** The rare commands: the history, then stopping the value (danger, last). */
    readonly menu: {
        readonly label: string
        readonly entries: ReadonlyArray<{
            readonly id: string
            readonly label: string
            readonly tone: "neutral" | "danger"
        }>
    }
    readonly retire: PickConfirmView | null
}

/** One row of the conflicts of the inbox: the subject and attribute, its competing values with how many documents, and its topic. */
export interface InboxConflictRowView {
    readonly id: string
    readonly title: string
    readonly line: string
    readonly badge: string | null
}

/** One row of a side card of the inbox: a customer question or a public text waiting, and where answering it goes. */
export interface InboxSideRowView {
    readonly id: string
    readonly title: string
    readonly line: string
    readonly href: string | null
}

/** The words of the to-do inbox. */
export interface InboxCopy {
    readonly table: FactPickCopy
    readonly trustFilterLabel: string
    readonly trustAll: string
    readonly trustHighOnly: string
    readonly groupingLabel: string
    readonly byDocument: string
    readonly bySubject: string
    readonly conflictsTitle: string
    readonly conflictsFact: string
    readonly compare: string
    readonly inboxEmptyTitle: string
    readonly inboxEmptyBody: string
    readonly inboxEmptyAction: string
    readonly errorTitle: string
    readonly errorBody: string
    readonly retry: string
    readonly progressTitle: string
    readonly progressLabel: string
    readonly progressValue: string
    readonly progressNote: string
    readonly asksTitle: string
    readonly asksMore: string
    readonly proposalsTitle: string
    readonly read: string
    readonly dismiss: string
    readonly rowMenu: string
}

/** What the to-do inbox draws: the conflicts, the fresh facts to tick, the side cards, and the drawers open. */
export interface InboxView {
    /** The first read has no data yet. */
    readonly isWaiting: boolean
    /** The read failed: the page is one notice with its retry. */
    readonly isFailed: boolean
    readonly canWrite: boolean
    readonly conflicts: ReadonlyArray<InboxConflictRowView>
    readonly mergedNote: string | null
    /** How many fresh facts wait, before the trust filter. */
    readonly total: number
    readonly trust: "all" | "high"
    readonly trustCounts: { readonly all: number; readonly high: number }
    readonly grouping: "document" | "subject"
    readonly groups: ReadonlyArray<FactPickGroupView>
    readonly bar: PickSelectionBarView
    readonly confirm: PickConfirmView | null
    readonly progress: { readonly used: number; readonly total: number }
    readonly asks: ReadonlyArray<InboxSideRowView>
    readonly asksMoreHref: string
    readonly proposals: ReadonlyArray<InboxSideRowView>
    readonly conflict: ConflictDrawerView | null
    readonly detail: FactDrawerDetailView | null
    readonly factDrawer: FactDrawerView | null
}
