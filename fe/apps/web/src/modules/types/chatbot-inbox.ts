/** A file that came with a message. */
export interface ChatMessageFile {
    readonly id: string
    readonly name: string
    readonly contentType: string
    readonly url: string
}

/** Where the deal stands: the five steps of the one customer record. */
export interface ChatbotStageStepsView {
    readonly title: string
    readonly label: string
    readonly steps: ReadonlyArray<{
        readonly id: string
        readonly label: string
    }>
    readonly currentId: string
}

/** One state mark of a conversation. */
interface ChatbotListChip {
    readonly id: string
    readonly label: string
    readonly tone: "warning" | "accent" | "neutral"
    readonly isDot: boolean
}

/** One conversation row, as plain words. */
export interface ChatbotListItem {
    readonly id: string
    readonly name: string
    readonly preview: string
    readonly time: string
    readonly channel: string
    readonly chips: ReadonlyArray<ChatbotListChip>
}

/** The conversation pane: its words, its filters, the query and the rows. */
export interface ChatbotConversationListView {
    readonly title: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearLabel: string
    readonly listLabel: string
    readonly query: string
    readonly filters: ReadonlyArray<{
        readonly value: string
        readonly label: string
    }>
    readonly selectedFilter: string
    readonly items: ReadonlyArray<ChatbotListItem>
    readonly hasConversations: boolean
    readonly emptyListTitle: string
    readonly emptyListBody: string
    readonly emptyFilter: string
    readonly selectedId: string | null
    /** The conversations are not read yet: the pane draws skeleton rows. */
    readonly isSkeleton?: boolean
}

/** One state mark of the conversation. */
interface ChatbotThreadChip {
    readonly id: string
    readonly label: string
    readonly tone: "warning" | "accent" | "neutral"
    readonly isDot: boolean
}

/** One entry of the thread: a day divider, a system line or a message bubble. */
interface ChatbotThreadItem {
    readonly id: string
    readonly kind: "day" | "system" | "bubble"
    readonly text: string
    readonly side: "incoming" | "outgoing"
    readonly author: string
    readonly meta: string
    readonly aiMark: string | null
    readonly avatarName: string | null
    readonly deliveryText: string | null
    readonly deliveryKind: "queued" | "sent" | "failed" | "unknown" | null
    readonly files: ReadonlyArray<ChatMessageFile>
}

/** The open conversation: its words, its entries and the composer. */
export interface ChatbotThreadViewData {
    /** The thread is still being fetched: three skeleton bubbles stand in. */
    readonly isResolving: boolean
    readonly hasThread: boolean
    readonly pickBody: string
    readonly backLabel: string
    readonly infoLabel: string
    readonly isInfoOpen: boolean
    readonly name: string
    readonly channel: string
    readonly chips: ReadonlyArray<ChatbotThreadChip>
    readonly entries: ReadonlyArray<ChatbotThreadItem>
    readonly canReply: boolean
    readonly lockedText: string
    readonly composerLabel: string
    readonly composerPlaceholder: string
    readonly composerHint: string
    readonly sendLabel: string
    readonly draft: string
    readonly notSentTitle: string
    readonly error: string | null
    readonly isSending: boolean
}

/** The waiting question the AI handed to a person, with the draft answer. */
interface ChatbotSideEscalation {
    readonly title: string
    readonly askedLabel: string
    readonly question: string
    readonly assigned: string | null
    readonly draftLabel: string
    readonly draftHint: string
    readonly draft: string
    readonly sendLabel: string
    readonly declineLabel: string
    readonly isAnswering: boolean
    readonly noticeTone: "negative" | "affirmative" | null
    readonly noticeTitle: string
    readonly noticeText: string | null
}

/** Who is replying and the command that changes it. */
interface ChatbotSideHandling {
    readonly title: string
    readonly text: string
    readonly buttonLabel: string
    readonly hint: string | null
    readonly isBusy: boolean
}

/** The lead behind the conversation. */
interface ChatbotSideLead {
    readonly name: string
    readonly facts: ReadonlyArray<{
        readonly id: string
        readonly term: string
        readonly description: string
    }>
    readonly openLabel: string
    readonly openHref: string
}

/** The customer pane: who the customer is, the waiting question, who replies and the lead. */
export interface ChatbotSidePanelView {
    readonly title: string
    readonly closeLabel: string
    readonly hasThread: boolean
    readonly customerName: string
    readonly channelLine: string
    readonly escalation: ChatbotSideEscalation | null
    readonly handling: ChatbotSideHandling
    /** The stage of the customer's deal; null while the customer was not captured. */
    readonly stage: ChatbotStageStepsView | null
    readonly leadTitle: string
    readonly leadNone: string
    readonly lead: ChatbotSideLead | null
}

/** The resolved words, rows and panes of the inbox. */
export interface ChatbotConversationView {
    readonly title: string
    readonly actionFailedTitle: string
    readonly actionError: string | null
    readonly pane: "list" | "thread"
    readonly hasSelection: boolean
    readonly pickTitle: string
    readonly pickBody: string
    readonly list: ChatbotConversationListView
    readonly thread: ChatbotThreadViewData
    readonly sideLabel: string
    readonly closeSideLabel: string
    readonly isInfoOpen: boolean
    readonly side: ChatbotSidePanelView
}
