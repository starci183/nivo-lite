import type { DataSlot, SlotLabels } from "./slot"

/** One button a point offers: its words as the back end stored them, and whether it asks for a typed value first. */
export interface CritiqueChoiceView {
    readonly id: string
    readonly label: string
    readonly needsInput: boolean
    /** The placeholder of the typed value; null when the choice asks for none. */
    readonly inputHint: string | null
}

/** One quoted passage of the document (or of another document), verbatim, with where it stands. */
export interface CritiqueQuoteView {
    readonly id: string
    readonly text: string
    /** The document the words come from when it is not this one; null for this document. */
    readonly source: string | null
    /** "trang 4", "slide 2": where the words stand; null when the reader keeps no place. */
    readonly place: string | null
}

/** One term and value of the comparison a point draws: what is in force and what the document says. */
export interface CritiqueCompareRowView {
    readonly id: string
    readonly term: string
    readonly value: string
    /** The 12 muted line: the document or the place the value stands in. */
    readonly meta: string | null
}

/** One point of the critic as a row: what NIVO doubts, the words it doubts, why, the question and what the owner may press. */
export interface CritiquePointView {
    readonly id: string
    readonly title: string
    /** Names the kind when the group holds several (hearsay, no date); null otherwise. */
    readonly badge: string | null
    readonly quotes: ReadonlyArray<CritiqueQuoteView>
    /** The two rows of a contradiction (the value in force, the document's), null when the point compares nothing. */
    readonly compare: ReadonlyArray<CritiqueCompareRowView> | null
    readonly why: string
    readonly question: string
    /** The buttons of the point; empty for a reader who may not answer, or for a point with none. */
    readonly choices: ReadonlyArray<CritiqueChoiceView>
}

/** The points of one group, under the group's label. */
export interface CritiqueGroupView {
    readonly id: string
    readonly label: string
    readonly points: ReadonlyArray<CritiquePointView>
}

/** The small input a typed choice opens under its point. */
export interface CritiqueEditorView {
    readonly pointId: string
    readonly choiceId: string
    readonly label: string
    readonly hint: string
    readonly value: string
}

/** The words every point draws. */
export interface CritiqueCopy {
    readonly listLabel: string
    readonly skip: string
    readonly send: string
    readonly cancel: string
    readonly compareLabel: string
    readonly emptyBody: string
    readonly errorBody: string
}

/** What the notice above the points says while the critic still reads, or when it gave up. */
export interface CritiqueNoticeView {
    readonly kind: "reading" | "failed"
    readonly title: string
    readonly body: string
    /** The retry of a review that did not finish; null while it reads or when the viewer may not retry. */
    readonly retry: { readonly label: string; readonly isPending: boolean } | null
}

/** Everything the points block draws. */
export interface DocumentQuestionsView {
    readonly slot: DataSlot<ReadonlyArray<CritiqueGroupView>>
    readonly placeholder: ReadonlyArray<CritiqueGroupView>
    readonly slotLabels: SlotLabels
    readonly copy: CritiqueCopy
    /** "Document · 3 points the owner must answer", on the page ground above the cards; null until the read answers. */
    readonly headLine: string | null
    readonly notice: CritiqueNoticeView | null
    /** The point being answered with a typed value; null when none is. */
    readonly editor: CritiqueEditorView | null
    /** The point a command is running for; its buttons wait. */
    readonly pendingId: string | null
}

/** One line of "what customers may read" with its count. */
export interface ReleaseRowView {
    readonly id: string
    readonly term: string
    readonly value: string
}

/** What the release card draws: the document, how much customers read and what holds the rest. */
export interface DocumentReleaseView {
    readonly title: string
    /** "9 passages customers can read". */
    readonly readable: string
    readonly rows: ReadonlyArray<ReleaseRowView>
    /** "See N points": scrolls to the points; null when none are open. */
    readonly seePoints: string | null
    /** The one red command; null unless the viewer is the owner and passages wait for the review. */
    readonly release: {
        readonly label: string
        readonly isPending: boolean
        readonly confirm: {
            readonly title: string
            readonly description: string
            readonly confirmLabel: string
            readonly cancelLabel: string
        }
    } | null
}

/** The release card with the status of its read. */
export interface DocumentReleasePanelView {
    readonly slot: DataSlot<DocumentReleaseView>
    readonly placeholder: DocumentReleaseView
    readonly slotLabels: SlotLabels
    readonly label: string
    readonly errorBody: string
}

/** One document with open points as a row of the to-do tab: what it is, how many points wait, and where to answer them. */
export interface CritiqueTodoRowView {
    readonly id: string
    readonly title: string
    /** "3 points waiting for you". */
    readonly line: string
    /** "2 important": the points that hold passages back; null when none does. */
    readonly badge: string | null
    readonly href: string
}

/** The "questions of the documents" card of the to-do tab. */
export interface CritiqueTodoView {
    readonly slot: DataSlot<ReadonlyArray<CritiqueTodoRowView>>
    readonly placeholder: ReadonlyArray<CritiqueTodoRowView>
    readonly slotLabels: SlotLabels
    readonly label: string
    readonly open: string
    readonly listLabel: string
}

/** The link of a document's questions as the document page draws it ("Questions of the document (3)"); null when none wait. */
export interface DocumentQuestionsLinkView {
    readonly label: string
    readonly href: string
}
