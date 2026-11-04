import type { BadgeTone } from "@starci/grammar/common"
import type { ChatbotConversationView } from "./chatbot-inbox"
import type { ChatbotInboxActions } from "./chatbot-inbox-actions"
import type { WorkbenchAsideActions, WorkbenchAsideView } from "./panes"
import type { SlotPanelProps } from "./slot"
import type {
    WorkbenchDashboardRegions,
    WorkbenchExplanationView,
    WorkbenchFigureRegion,
    WorkbenchWaitingCardView,
} from "./workbench-dashboard"
/** The actual Chatbot areas and customer filters, shared by the reader and pure inventory. */
export const CHATBOT_WORKBENCH_TABS = ["customers", "gaps"] as const
/** Defines the supported customer list filters in display order. */
export const CHATBOT_CUSTOMER_FILTERS = ["all", "needs", "progress", "today"] as const
/** Restricts the customer list to a supported filter. */
export type CustomerFilter = (typeof CHATBOT_CUSTOMER_FILTERS)[number]
/** Provides a customer identity and conversation status for the inbox list. */
export interface CustomerRowView {
    readonly id: string
    /** The conversation the row opens in the inbox. */
    readonly href: string
    readonly name: string
    /** One line: the channel, the company and what the customer needs, as far as they are known. */
    readonly summary: string
    /** The deal stage; null while the customer was not captured. */
    readonly stage: string | null
    /** Where the conversation stands: who answers next, or that a person is awaited. */
    readonly status: {
        readonly label: string
        readonly tone: BadgeTone
    }
}
/** Provides one knowledge gap and its answer destination. */
export interface ChatbotGapRow {
    readonly id: string
    readonly title: string
    readonly line: string
    readonly badges: ReadonlyArray<{
        readonly label: string
        readonly tone: "neutral" | "warning"
    }>
    readonly answerLabel: string
    readonly answerHref: string
    readonly dismissLabel: string
}
/** Supplies resolved customer search, filter, and empty-state copy. */
export interface ChatbotCustomerWords {
    readonly label: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearLabel: string
    readonly filtersLabel: string
    readonly emptyMessage: string
    readonly emptyDescription: string
    readonly full: string
}
/** Combines the customer read with its active search and filter state. */
export interface ChatbotCustomersView extends SlotPanelProps<ReadonlyArray<CustomerRowView>> {
    readonly words: ChatbotCustomerWords
    readonly query: string
    readonly filter: CustomerFilter
    readonly chips: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly isFull: boolean
}
/** Keeps the draft reply attached to its waiting work item. */
export interface ChatbotWaitingEditView {
    readonly workItemId: string
    readonly text: string
    readonly label: string
    readonly sendLabel: string
    readonly cancelLabel: string
    readonly isBusy: boolean
}
/** Combines the knowledge-gap read with its heading and fill availability. */
export interface ChatbotGapsView extends SlotPanelProps<ReadonlyArray<ChatbotGapRow>> {
    readonly title: string
    readonly description: string
    readonly isPending: boolean
    readonly canFill: boolean
}
/** Data-only drawings for the two areas, optional conversation and explanation. */
export interface ChatbotWorkbenchViewData {
    readonly aside: WorkbenchAsideView
    readonly why: WorkbenchExplanationView
    readonly regions: WorkbenchDashboardRegions
    readonly selectedTab: (typeof CHATBOT_WORKBENCH_TABS)[number]
    readonly tabsLabel: string
    readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly ribbon: WorkbenchFigureRegion
    readonly waiting: WorkbenchWaitingCardView & { readonly edit: ChatbotWaitingEditView | null }
    readonly customers: ChatbotCustomersView
    readonly inbox: SlotPanelProps<ChatbotConversationView>
    readonly gaps: ChatbotGapsView
}
/** Commands of the Chatbot workbench: the tabs, the customer list, the inbox, the waiting card and the gaps. */
export interface ChatbotWorkbenchActions {
    readonly aside: WorkbenchAsideActions
    readonly selectTab: (id: string) => void
    readonly closeWhy: () => void
    readonly retryDashboard: () => void
    readonly retry: () => void
    readonly customers: {
        readonly query: (value: string) => void
        readonly filter: (value: string) => void
        readonly retry: () => void
    }
    readonly inbox: ChatbotInboxActions & {
        readonly reload: () => void
    }
    readonly waiting: {
        readonly command: (rowId: string, commandId: string) => void
        readonly retry: () => void
        readonly changeEdit: (text: string) => void
        readonly sendEdit: () => void
        readonly cancelEdit: () => void
    }
    readonly gaps: {
        readonly retry: () => void
        readonly dismiss: (id: string) => void
    }
}
