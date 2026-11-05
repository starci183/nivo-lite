import type { BrainPageHeaderView } from "./brain-page"
import type { DocChipView, DocListCopy, DocListFace } from "./knowledge-docs"
import type { PaneGridLayout } from "./panes"
import type { DataSlot, SlotLabels } from "./slot"

/** One public document as the middle pane draws it: its head, why it waits, where it came from and what it says now. */
export interface PublicDraftView {
    readonly id: string
    readonly title: string
    /** One line under the title: when and from what it was written. */
    readonly meta: string
    readonly badge: DocChipView
    /** Why the document waits (being drafted, failed, an internal document changed); null when nothing is in the way. */
    readonly note: {
        readonly tone: "informative" | "negative" | "cautionary"
        readonly title: string
        readonly description: string | null
    } | null
    /** The title and the text can be edited: not while NIVO is still drafting. */
    readonly canEdit: boolean
    /** The internal documents it was drafted from, each with what changed. */
    readonly sources: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly leftOut: string | null
    readonly approval: string | null
    readonly publishedBody: string | null
    readonly redraftLabel: string | null
    readonly approveLabel: string | null
}

/** The values and state of the editor of the open public document. */
export interface PublicFormView {
    readonly title: string
    readonly body: string
    readonly error: string | undefined
    readonly isBusy: boolean
    readonly pendingAction: "save" | "approve" | "redraft" | undefined
}

/** One customer question nobody answered yet, with the way to answer it and to set it aside. */
export interface PublicAskView {
    readonly id: string
    readonly question: string
    readonly line: string
    readonly answerHref: string
    readonly isPending: boolean
}

/** The words of the public documents screen that belong to no data. */
export interface PublicBrainCopy extends DocListCopy {
    readonly grid: string
    readonly back: string
    readonly moreActions: string
    readonly closeAside: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly noteTitle: string
    readonly noteBody: string
    readonly titleLabel: string
    readonly bodyLabel: string
    readonly sourcesLabel: string
    readonly publishedLabel: string
    readonly saveLabel: string
    readonly laterLabel: string
    readonly archiveLabel: string
    readonly archiveTitle: (title: string) => string
    readonly archiveBody: string
    readonly cancelLabel: string
    readonly composeLabel: string
    readonly errorTitle: string
    readonly asideTitle: string
    readonly asideCount: (count: number) => string
    readonly asideEmpty: string
    readonly asideError: string
    readonly asideHint: string
    readonly answerLabel: string
    readonly skipLabel: string
    readonly listTitle: string
}

/** What the public documents screen draws. */
export interface PublicBrainView {
    readonly props: {
        readonly header: BrainPageHeaderView
        readonly panelId: string
        readonly copy: PublicBrainCopy
        readonly grid: PaneGridLayout
        readonly list: DocListFace
        /** The open document: nothing chosen, or its read in whatever state it is. */
        readonly main:
            | { readonly kind: "none" }
            | { readonly kind: "doc"; readonly slot: DataSlot<ReadonlyArray<PublicDraftView>> }
        /** The open document, once its read settled to data or while it is being read; null otherwise. */
        /** The first draft to draw while the read waits: the same shape as a ready one. */
        readonly placeholder: PublicDraftView
        /** The open document and its decisions: only once its read settled, and only for a member who may write; null otherwise. */
        readonly decided: PublicDraftView | null
        readonly opened: { readonly draft: PublicDraftView; readonly isLoading: boolean } | null
        readonly form: PublicFormView
        readonly asks: DataSlot<ReadonlyArray<PublicAskView>>
        readonly asksLabels: SlotLabels
        readonly isWaiting: boolean
        readonly canWrite: boolean
        readonly composeHref: string
        readonly isRemoveOpen: boolean
        readonly isRemoving: boolean
    }
    readonly on: {
        readonly reviewAll: () => void
        readonly selectTab: (id: string) => void
        readonly select: (id: string) => void
        readonly search: (value: string) => void
        readonly setTab: (id: string) => void
        readonly clear: () => void
        readonly back: () => void
        readonly retry: () => void
        readonly compose: () => void
        readonly setTitle: (value: string) => void
        readonly setBody: (value: string) => void
        readonly save: () => void
        readonly redraft: () => void
        readonly approve: () => void
        readonly menu: (id: string) => void
        readonly removeOpenChange: (isOpen: boolean) => void
        readonly remove: () => Promise<void>
        readonly skipAsk: (id: string) => void
    }
}

/** One internal document NIVO may draft from. */
interface SourceChoiceView {
    readonly id: string
    readonly label: string
}

/** Copy, values and state the connected picker supplies. */
export interface PublicPickerDrawerView {
    readonly props: {
        readonly isOpen: boolean
        readonly isPending: boolean
        readonly title: string
        readonly closeLabel: string
        readonly cancelLabel: string
        readonly submitLabel: string
        /** Says that NIVO reads internal documents with no customer present, and what it leaves out. */
        readonly note: string
        /** The other way to start a public document: writing it by hand instead of asking NIVO. */
        readonly writeInstead: { readonly label: string; readonly href: string }
        readonly titleLabel: string
        readonly sourcesLabel: string
        readonly sourcesHint: string
        readonly slotLabels: SlotLabels
        readonly instructionsLabel: string
        readonly sources: DataSlot<ReadonlyArray<SourceChoiceView>>
        readonly docTitle: string
        readonly selected: ReadonlyArray<string>
        readonly instructions: string
        readonly error?: string | undefined
        readonly failTitle: string
    }
    readonly on: {
        readonly close: () => void
        readonly submit: () => void
        readonly setTitle: (value: string) => void
        readonly setSelected: (ids: ReadonlyArray<string>) => void
        readonly setInstructions: (value: string) => void
        readonly retry: () => void
    }
}

/** Copy, values and state the connected write form supplies. */
export interface PublicWriteDrawerView {
    readonly props: {
        readonly isOpen: boolean
        readonly isPending: boolean
        readonly title: string
        readonly closeLabel: string
        readonly cancelLabel: string
        readonly submitLabel: string
        /** Says that what is written here is for customers, and that it is not a copy of an internal document. */
        readonly note: string
        readonly titleLabel: string
        readonly bodyLabel: string
        readonly docTitle: string
        readonly body: string
        readonly error?: string | undefined
        readonly failTitle: string
    }
    readonly on: {
        readonly close: () => void
        readonly submit: () => void
        readonly setTitle: (value: string) => void
        readonly setBody: (value: string) => void
    }
}
