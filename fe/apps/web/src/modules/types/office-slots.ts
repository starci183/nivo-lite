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

/** What the thread draws. */
export interface OfficeThreadProps {
    readonly props: {
        readonly state: "loading" | "error" | "ready"
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
        readonly sendCommand: (id: string) => void
        readonly cancelCommand: (id: string) => void
        readonly reply: (handle: string) => void
        readonly loadEarlier: () => void
        readonly retry: () => void
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
        readonly isLoading: boolean
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
        readonly isLoading: boolean
        readonly text: OfficeText
    }
    readonly on: {
        readonly openGroup: () => void
        readonly openAgent: (id: string) => void
        readonly openCustomer: (id: string) => void
    }
}

/** What the right column draws. */
export interface OfficeInfoPanelProps {
    readonly props: {
        readonly info: OfficeInfoView
        /** Docked as a column (draws its own header and close); false inside the drawer, which owns title and close. */
        readonly isDocked: boolean
        readonly text: OfficeText
    }
    readonly on: {
        readonly jumpApproval: (id: string) => void
        readonly jumpException: (id: string) => void
        readonly mention: (handle: string) => void
        readonly openTasks: () => void
        readonly close: () => void
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
