import type { BreadcrumbItem } from "@starci/grammar/common"
import type { ModuleIconName } from "./module-icon"
import type { DataSlot, SlotLabels } from "./slot"

/** The tone a status badge takes. */
export type StatusTone = "neutral" | "accent" | "success" | "warning" | "danger"

/** One run of a message: plain text, or the chip of a person, agent or group the author tagged. The offset is its place in the text. */
export type BodySegment =
    | { readonly kind: "text"; readonly offset: number; readonly text: string }
    | { readonly kind: "mention"; readonly offset: number; readonly name: string }

/** One suggestion of the composer: what is inserted and the line under it. */
export interface ComposerOption {
    readonly id: string
    readonly label: string
    readonly description?: string
}

/** One thread of the list, worded. */
export interface ThreadRowView {
    readonly id: string
    readonly title: string
    readonly statusLabel: string
    readonly isSelected: boolean
    readonly countLabel: string
}

/** One person tagged on an approval card. */
export interface ApprovalLineView {
    readonly id: string
    readonly name: string
    readonly roleLabel: string
    readonly statusLabel: string
    readonly tone: StatusTone
}

/** The approval card of a message, worded. */
export interface ThreadApprovalCardView {
    readonly messageId: string
    readonly title: string
    readonly ruleLine: string
    readonly policyLabel: string
    readonly expiryLine: string
    readonly approvers: ReadonlyArray<ApprovalLineView>
    readonly excluded: ReadonlyArray<{ readonly id: string; readonly line: string }>
    readonly fallbackLine: string | null
    /** Whether the card still waits for a decision: the buttons show only then. */
    readonly isPending: boolean
    /** Who decided it and how, or an empty text while it waits. */
    readonly decidedLine: string
    readonly decidedTone: StatusTone
}

/** One message of the thread, worded. */
export interface ThreadMessageView {
    readonly id: string
    readonly authorName: string
    readonly isAgent: boolean
    /** The module glyph of an agent author; null for a person. */
    readonly glyph: ModuleIconName | null
    readonly time: string
    readonly segments: ReadonlyArray<BodySegment>
    readonly quoted: ReadonlyArray<string>
    readonly approval: ThreadApprovalCardView | null
}

/** The open thread: its title and messages. */
export interface ThreadFeedView {
    readonly title: string
    readonly subtitle: string
    readonly messages: ReadonlyArray<ThreadMessageView>
}

/** One step of the chain, worded. */
export interface ChainStepView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly statusLabel: string
    readonly tone: StatusTone
}

/** The Execution chain panel, worded. */
export interface ChainPanelView {
    /** "6 steps, 2 human decisions, 4 minutes", or an empty text for an empty chain. */
    readonly summaryLine: string
    /** Where the chain stands, or an empty text when it is empty or complete. */
    readonly stateLine: string
    readonly stateTone: StatusTone
    readonly steps: ReadonlyArray<ChainStepView>
    readonly isComplete: boolean
}

/** The words of the approval card's controls. */
export interface ThreadApprovalLabels {
    readonly cardLabel: string
    readonly approve: string
    readonly reject: string
}

/** The words of the Execution chain panel. */
export interface ThreadChainLabels {
    readonly stepsLabel: string
    readonly emptyMessage: string
    readonly completeTitle: string
    readonly completeHint: string
}

/** The words of the new-thread form. */
export interface ThreadRailForm {
    readonly label: string
    readonly placeholder: string
    readonly createLabel: string
    readonly cancelLabel: string
}

/** The words, values and state of the work threads board. */
export interface WorkThreadBoardView {
    readonly crumbLabel: string
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    readonly title: string
    readonly subtitle: string
    readonly rail: {
        readonly title: string
        readonly listLabel: string
        readonly newLabel: string
        readonly form: ThreadRailForm
        readonly slot: DataSlot<ReadonlyArray<ThreadRowView>>
        readonly slotLabels: SlotLabels
        readonly isFormOpen: boolean
        readonly titleDraft: string
        readonly isCreating: boolean
    }
    readonly thread: {
        readonly hasThread: boolean
        readonly noSelection: string
        readonly slot: DataSlot<ThreadFeedView>
        readonly slotLabels: SlotLabels
        readonly feedLabel: string
        readonly feedEmpty: string
        readonly aiLabel: string
        readonly quotedLabel: string
        readonly approvalLabels: ThreadApprovalLabels
        readonly decidingId: string | null
        readonly composerLabel: string
        readonly composerPlaceholder: string
        readonly composerHint: string
        readonly mentionLabel: string
        readonly sendLabel: string
        readonly draft: string
        readonly options: ReadonlyArray<ComposerOption>
        readonly isSending: boolean
    }
    readonly chain: {
        readonly title: string
        readonly slot: DataSlot<ChainPanelView>
        readonly slotLabels: SlotLabels
        readonly labels: ThreadChainLabels
    }
}

/** What the work threads board asks of its owner. */
export interface WorkThreadBoardHandlers {
    readonly pick: (threadId: string) => void
    readonly openForm: () => void
    readonly cancelForm: () => void
    readonly title: (value: string) => void
    readonly create: () => void
    readonly draft: (value: string) => void
    readonly pickMention: (option: ComposerOption) => void
    readonly send: () => void
    readonly approve: (messageId: string) => void
    readonly reject: (messageId: string) => void
    readonly retry: () => void
}
