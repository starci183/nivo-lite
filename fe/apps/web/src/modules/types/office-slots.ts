import type { PaneTrack } from "@starci/grammar/common"
import type {
    OfficeAvatarView,
    OfficeInfoView,
    OfficeListView,
    OfficeMentionView,
    OfficeOutboxView,
    OfficeTaskView,
    OfficeThreadItem,
    OfficeWorkDecision,
} from "./office"

/** The command card being prepared while NIVO reads the owner's line. */
export interface OfficeReadingView {
    readonly avatar: OfficeAvatarView
    readonly ask: string
    readonly agent: string
    readonly label: string
    readonly gateNote: string
}

/** The product state of one thread card, lifted into the connected block: what the owner is editing and which part is open. */
export interface OfficeCardDraft {
    readonly isEditing: boolean
    readonly isExpanded: boolean
    /** The edited text; null while the owner has not typed (the card shows its own text). */
    readonly text: string | null
    /** The edited amount; null while untouched. */
    readonly amount: string | null
    readonly values: Readonly<Record<string, string>>
    readonly candidateId: string | null
    readonly basis: string
}

/** What the thread draws once its messages are in. */
export interface OfficeThreadProps {
    readonly props: {
        /** The drawn thread shows skeleton lines instead of the messages. */
        readonly isLoading: boolean
        /** The current thread cards and their concrete drafts. */
        readonly cards: ReadonlyArray<{
            readonly item: Exclude<OfficeThreadItem, { readonly kind: "day" | "message" }>
            readonly draft: OfficeCardDraft
            readonly label: string
            readonly basisDescription: string | null
        }>
        readonly copy: {
            readonly thread: {
                readonly loadEarlier: string
                readonly emptyMessage: string
                readonly emptyMessageHint: string
            }
            readonly message: {
                readonly copied: string
                readonly copyText: string
                readonly reply: string
                readonly cmdOpenWork: string
                readonly aiBadge: string
            }
            readonly outbox: { readonly sendFailed: string; readonly sending: string }
        }
        readonly basisMin: number
        readonly cardCopy: {
            readonly exceptionForm: {
                readonly exceptionMissingHint: string
                readonly basisNeeded: string
                readonly waitingManager: string
                readonly exceptionSaveContinue: string
                readonly exceptionCancelEdit: string
                readonly exceptionEditContinue: string
                readonly exceptionReject: string
                readonly exceptionMissing: string
                readonly basisLabel: string
                readonly basisPlaceholder: string
                readonly exceptionCandidates: string
                readonly exceptionDraft: string
                readonly exceptionAmount: string
                readonly exceptionApprove: string
                readonly exceptionSendDraft: string
            }
            readonly command: {
                readonly cmdRowAgent: string
                readonly cmdRowCommand: string
                readonly cmdPending: string
                readonly cmdSentBadge: string
                readonly cmdCancelledBadge: string
                readonly cmdFailed: string
                readonly cmdCancel: string
                readonly cmdSend: string
                readonly cmdOpenWork: string
            }
            readonly approval: {
                readonly draftLabel: string
                readonly showLess: string
                readonly showMore: string
                readonly waitingManager: string
                readonly approveEdited: string
                readonly approveSend: string
                readonly cancelEdit: string
                readonly edit: string
                readonly reject: string
                readonly aiBadge: string
                readonly openLead: string
            }
            readonly exception: {
                readonly reconcileCredit: string
                readonly reconcileWarning: string
                readonly exceptionResult: string
                readonly exceptionOpenLead: string
                readonly exceptionProposes: string
                readonly exceptionErrorLabel: string
                readonly exceptionAsked: string
                readonly exceptionWillReply: string
            }
            readonly result: {
                readonly approveEdited: string
                readonly cardApprove: string
                readonly cancelEdit: string
                readonly edit: string
                readonly cardDecline: string
                readonly waitingManager: string
                readonly draftLabel: string
                readonly cardSources: string
            }
        }
        readonly receipts: ReadonlyArray<{
            readonly key: string
            readonly overflowLabel: string
            readonly moreLabel: string | null
        }>
        readonly copiedKey: string | null
        readonly items: ReadonlyArray<OfficeThreadItem>
        readonly outbox: ReadonlyArray<OfficeOutboxView>
        readonly reading: OfficeReadingView | null
        /** "X is typing..." when an agent is called, else empty. */
        readonly typing: string
        readonly busyId: string | null
        readonly hasEarlier: boolean
        readonly isLoadingEarlier: boolean
    }
    readonly on: {
        readonly decideApproval: (id: string, decision: "approved" | "rejected", editedDraft: string | null) => void
        readonly decideWork: (id: string, choice: OfficeWorkDecision) => void
        /** Decides the execution or work item a result card names; `edited` is the edited draft, if any. */
        readonly decideCard: (
            kind: "execution" | "work_item",
            id: string,
            decision: "approved" | "rejected",
            edited: string | null,
        ) => void
        readonly sendCommand: (id: string) => void
        readonly cancelCommand: (id: string) => void
        readonly reply: (handle: string) => void
        readonly loadEarlier: () => void
        /** Changes the draft of one card. */
        readonly editCard: (key: string, patch: Partial<OfficeCardDraft>) => void
        /** Copies the text of one message. */
        readonly copy: (key: string, text: string) => void
    }
}

/** What the pinned composer draws. */
/** The file control of the Office composer. */
export interface OfficeComposerFile {
    /** The chosen file name, or null. */
    readonly name: string | null
    /** The resolved reason the chosen file cannot go, or null. */
    readonly problem: string | null
    /** The types the picker offers. */
    readonly accept: string
}

/** What the composer draws and reports. */
export interface OfficeComposerProps {
    readonly props: {
        readonly draft: string
        readonly mentions: ReadonlyArray<OfficeMentionView>
        readonly isSending: boolean
        readonly isLoading: boolean
        /** Changes whenever the composer should take focus (a mention was added from outside). */
        readonly focusKey: number
        /** The file that goes with the line. */
        readonly file: OfficeComposerFile
        readonly prompts: ReadonlyArray<string>
        readonly copy: {
            readonly quickLabel: string
            readonly removeFile: string
            readonly attachFile: string
            readonly mentionButton: string
            readonly composerLabel: string
            readonly composerPlaceholder: string
            readonly mentionLabel: string
            readonly send: string
            readonly composerHint: string
        }
    }
    readonly on: {
        readonly change: (value: string) => void
        readonly send: () => void
        readonly chooseFile: (file: File) => void
        readonly clearFile: () => void
    }
}

/** What the left column draws. */
export interface OfficeConversationsProps {
    readonly props: {
        readonly list: OfficeListView
        readonly isLoading: boolean
        readonly query: string
        readonly filter: string
        readonly filters: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly copy: {
            readonly searchLabel: string
            readonly searchPlaceholder: string
            readonly clearSearch: string
            readonly filterLabel: string
            readonly listLabel: string
            readonly empty: string
        }
    }
    readonly on: {
        readonly openGroup: (id: string) => void
        readonly openAgent: (id: string) => void
        readonly openCustomer: (id: string) => void
        readonly query: (value: string) => void
        readonly filter: (value: string) => void
        readonly formatMembersOverflow: (count: number) => string
    }
}

/** The pane areas and tracks of one arrangement of a pane grid. */
export interface Arrangement {
    readonly areas: ReadonlyArray<string>
    readonly columns: ReadonlyArray<PaneTrack>
    readonly rows: ReadonlyArray<PaneTrack>
}

/** What the right column draws. */
export interface OfficeInfoPanelProps {
    readonly props: {
        readonly info: OfficeInfoView
        readonly copy: {
            readonly pendingTitle: string
            readonly pendingNone: string
            readonly pendingJump: string
            readonly exceptionsTitle: string
            readonly exceptionsNone: string
            readonly exceptionJump: string
            readonly tasksTitle: string
            readonly tasksOpen: string
            readonly membersTitle: string
            readonly youTag: string
            readonly mention: string
            readonly chat11: string
            readonly addAgent: string
            readonly cardsTitle: string
            readonly channelsTitle: string
            readonly pinsTitle: string
        }
    }
    readonly on: {
        readonly jumpApproval: (id: string) => void
        readonly jumpException: (id: string) => void
        readonly jumpCard: (id: string) => void
        readonly mention: (handle: string) => void
        readonly openTasks: () => void
    }
}

/** What the team tasks draw. */
export interface OfficeTasksProps {
    readonly props: {
        readonly tasks: ReadonlyArray<OfficeTaskView & { readonly statusLabel: string }>
        readonly hasTasks: boolean
        readonly owner: string
        readonly status: string
        readonly ownerOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly statusOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly meta: string
        readonly copy: {
            readonly title: string
            readonly noTasks: string
            readonly noTasksHint: string
            readonly openLeads: string
            readonly noTasksMatch: string
            readonly noTasksMatchHint: string
            readonly clearFilters: string
            readonly openArrow: string
            readonly filterOwner: string
            readonly filterStatus: string
        }
    }
    readonly on: {
        readonly openLeads: () => void
        readonly owner: (value: string) => void
        readonly status: (value: string) => void
        readonly clear: () => void
    }
}
