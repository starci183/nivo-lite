import type { TeamChatMarkView } from "./team-chat-room"
import type { TeamChatStopChipTone } from "./team-chat-stop"

/** The typed `brain.change` card of a message, as the chat door reads it (`ChatMessageType.brainChange`). */
export interface TeamChatBrainChange {
    readonly changeId: string
    /** `change`, `add` or `retire`; an unknown kind reads as a change. */
    readonly kind: string
    /** `open`, `applied`, `rejected`, `superseded`; an unknown state reads as closed. */
    readonly state: string
    /** Where the proposal came from: `chat`, `learning` or `document`. */
    readonly origin: string
    readonly reason: string
    readonly revision: number
    readonly newValue: string
    readonly oldValue: string | null
    readonly unit: string | null
    readonly canApprove: boolean
    readonly canReject: boolean
    readonly canKeepBoth: boolean
    readonly factKey: { readonly subjectLabel: string; readonly attributeLabel: string }
    /** The value the truth holds now (or the plan that will); null for a truth that is new. */
    readonly current: {
        readonly value: string
        readonly source: string
        readonly version: number | null
        /** `near` when the value is another truth of nearly the same meaning; null or `same` otherwise. */
        readonly match: string | null
        /** Set when the value is a PLAN that starts at this moment (ISO), not yet in force. */
        readonly startsAt: string | null
        readonly factKey: { readonly subjectLabel: string; readonly attributeLabel: string } | null
    } | null
    readonly evidence: ReadonlyArray<{
        readonly kind: string
        readonly quote: string
        readonly at: string | null
        readonly by: { readonly name: string }
    }>
    readonly decidedBy: { readonly name: string; readonly at: string } | null
}

/** What a person decides on a change card. */
export type TeamChatBrainChangeAction = "approve" | "reject" | "keep_both"

/** One decision button of a change card. */
export interface TeamChatBrainChangeButtonView {
    readonly action: TeamChatBrainChangeAction
    readonly label: string
    readonly kind: "primary" | "neutral"
}

/** One row of the bordered list of a change card: its key, its value (struck when the new value replaces it) and the muted line under it. */
export interface TeamChatBrainChangeRowView {
    readonly id: string
    readonly name: string
    readonly value: string
    readonly isReplaced: boolean
    readonly note: string | null
}

/** One quote of the evidence list: the words and who said them, when. */
export interface TeamChatBrainChangeQuoteView {
    readonly id: string
    readonly quote: string
    readonly line: string
}

/** A change card with every word resolved. */
export interface TeamChatBrainChangeView {
    readonly changeId: string
    readonly revision: number
    readonly mark: TeamChatMarkView
    readonly meta: string
    readonly title: string
    readonly chip: { readonly label: string; readonly tone: TeamChatStopChipTone }
    /** "Delivery · Inner-city shipping fee", and after the change was put in force: the same with "old → new". */
    readonly keyLine: string
    readonly rows: ReadonlyArray<TeamChatBrainChangeRowView>
    readonly rowsLabel: string
    readonly reason: { readonly label: string; readonly text: string } | null
    readonly quotes: ReadonlyArray<TeamChatBrainChangeQuoteView>
    readonly quotesLabel: string
    readonly buttons: ReadonlyArray<TeamChatBrainChangeButtonView>
    /** The trace of the decision ("Pressed Agree"), then who and when; null while open. */
    readonly trace: { readonly title: string; readonly line: string } | null
    readonly traceLabel: string
    /** The note under a card a newer proposal replaced. */
    readonly note: string | null
}

/** What the thread does with the change cards: the card whose decision is in flight and the one handler. */
export interface TeamChatBrainChangeHandlers {
    /** The change whose decision is in flight, or null. */
    readonly pendingId: string | null
    readonly onAction: (changeId: string, action: TeamChatBrainChangeAction) => void
}
