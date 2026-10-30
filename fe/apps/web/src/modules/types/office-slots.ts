import type { PaneTrack } from "@starci/grammar/common"
import type {
    OfficeAvatarView,
    OfficeInfoView,
    OfficeListView,
    OfficeMentionView,
    OfficeOutboxView,
    OfficeTaskView,
    OfficeText,
    OfficeThreadItem,
    OfficeWorkDecision,
} from "./office"

/** The command card being prepared while NIVO reads the owner's line. */
export interface OfficeReadingView {
    readonly avatar: OfficeAvatarView
    readonly ask: string
    readonly agent: string
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
        readonly isSkeleton: boolean
        /** The draft of one card by item key (an untouched card has the empty draft), and the message whose text was just copied. */
        readonly draftOf: (key: string) => OfficeCardDraft
        readonly copiedKey: string | null
        readonly items: ReadonlyArray<OfficeThreadItem>
        readonly outbox: ReadonlyArray<OfficeOutboxView>
        readonly reading: OfficeReadingView | null
        /** "X is typing..." when an agent is called, else empty. */
        readonly typing: string
        readonly busyId: string | null
        readonly hasEarlier: boolean
        readonly isLoadingEarlier: boolean
        readonly text: OfficeText
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
export interface OfficeComposerProps {
    readonly props: {
        readonly draft: string
        readonly mentions: ReadonlyArray<OfficeMentionView>
        /** The handle of the installed Chatbot, if any: adds a quick prompt for it. */
        readonly chatbotHandle: string | null
        readonly isSending: boolean
        readonly isSkeleton: boolean
        /** Changes whenever the composer should take focus (a mention was added from outside). */
        readonly focusKey: number
        readonly text: OfficeText
    }
    readonly on: {
        readonly change: (value: string) => void
        readonly send: () => void
    }
}

/** What the left column draws. */
export interface OfficeConversationsProps {
    readonly props: {
        readonly list: OfficeListView
        readonly isSkeleton: boolean
        readonly text: OfficeText
    }
    readonly on: {
        readonly openGroup: (id: string) => void
        readonly openAgent: (id: string) => void
        readonly openCustomer: (id: string) => void
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
        readonly text: OfficeText
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
        readonly tasks: ReadonlyArray<OfficeTaskView>
        readonly text: OfficeText
    }
    readonly on: {
        readonly openLeads: () => void
    }
}
