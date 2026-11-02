import type {
    ActivityItemView,
    AttentionItemView,
    ContractItemView,
    LaneView,
    MoveDialogView,
    DecisionRowView,
    DecisionRowLabels,
    DecidedView,
    HandoffItemView,
    SalesOrderRowView,
} from "./sales"
import type { ContractImportDialogView } from "./contract-import"
import type { ChatbotConversationView } from "./chatbot-inbox"
import type { DataSlot, SlotLabels, SlotPanelProps } from "./slot"
import type {
    WorkbenchDashboardRegions,
    WorkbenchExplanationView,
    WorkbenchFigureRegion,
    WorkbenchWaitingCardView,
} from "./workbench-dashboard"

/** The actual Sales areas, shared by route interpretation and the pure drawing inventory. */
export const SALES_WORKBENCH_TABS = ["attention", "pipeline", "decisions", "handoff", "contracts", "activity"] as const
/** Supplies attention rows and resolved labels for the sales list. */
export interface SalesAttentionView {
    readonly label: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly rows: ReadonlyArray<AttentionItemView>
    readonly answerLabel: string
    readonly decideLabel: string
    readonly retryLabel: string
    readonly stopLabel: string
    readonly followUpLabel: string
    readonly replyLabel: string
    /** True while a retry or a stop is in flight: every command waits. */
    readonly isBusy: boolean
}
/** Supplies deal lanes and the current move dialog state. */
export interface SalesPipelineView {
    readonly label: string
    readonly lanes: ReadonlyArray<LaneView>
    readonly emptyText: string
    readonly moveLabel: string
    readonly cancelLabel: string
    readonly confirmLabel: string
    readonly dialog: MoveDialogView | null
    readonly isPending: boolean
}
/** Supplies pending and decided rows with their display copy. */
export interface SalesDecisionsView {
    readonly pendingLabel: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly decidedTitle: string
    readonly decidedBody: string
    readonly decidedEmptyTitle: string
    readonly decidedEmptyBody: string
    readonly pending: ReadonlyArray<DecisionRowView>
    readonly rowLabels: DecisionRowLabels
    readonly decided: ReadonlyArray<DecidedView>
}
/** Supplies the shipment editor fields and submission state. */
export interface SalesShipmentDrawerView {
    readonly isOpen: boolean
    readonly title: string
    readonly closeLabel: string
    readonly saveLabel: string
    readonly cancelLabel: string
    readonly noticeTitle: string
    readonly noticeText: string
    readonly carrierLabel: string
    readonly carrierHint: string
    readonly trackingLabel: string
    readonly carrier: string
    readonly tracking: string
    readonly error: string | null
    readonly isPending: boolean
}
/** Supplies order handoffs, shipping state, and resolved labels. */
export interface SalesHandoffsView {
    readonly label: string
    readonly intro: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly errorLabel: string
    readonly shipLabel: string
    readonly rows: ReadonlyArray<HandoffItemView>
    /** True while a hand-off is in flight: every command waits. */
    readonly isBusy: boolean
    readonly ship: SalesShipmentDrawerView | null
}
/** Supplies contract editor fields, choices, and resolved labels. */
export interface SalesContractEditorFields {
    readonly title: string
    readonly closeLabel: string
    readonly saveLabel: string
    readonly cancelLabel: string
    readonly leadLabel: string
    readonly leadOptions: ReadonlyArray<{
        readonly id: string
        readonly label: string
    }>
    readonly lead: string
    readonly customerLabel: string
    readonly customer: string
    readonly planLabel: string
    readonly planHint: string
    readonly plan: string
    readonly startLabel: string
    readonly endLabel: string
    readonly endHint: string
    readonly amountLabel: string
    readonly amount: string
    readonly statusLabel: string
    readonly statusOptions: ReadonlyArray<{
        readonly id: string
        readonly label: string
    }>
    readonly status: string
    readonly noteLabel: string
    readonly note: string
    readonly error: string | null
    readonly isPending: boolean
    readonly canSave: boolean
}
/** The controller carries ISO date text; native CalendarDate values belong only to its drawer adapter. */
export interface SalesContractEditorView extends SalesContractEditorFields {
    readonly start: string
    readonly end: string
}
/** Supplies contract list controls and optional editor dialogs. */
export interface SalesContractsBodyView {
    readonly intro: string
    readonly addLabel: string
    readonly importLabel: string
    readonly note: string
    readonly drawer: SalesContractEditorView | null
    readonly importDialog: ContractImportDialogView | null
}
/** Combines the contract read with its list controls and dialogs. */
export interface SalesContractsView extends SalesContractsBodyView {
    readonly label: string
    readonly editLabel: string
    readonly rows: DataSlot<ReadonlyArray<ContractItemView>>
    readonly rowsPlaceholder: ReadonlyArray<ContractItemView>
    readonly rowsLabels: SlotLabels
}
/** Supplies activity rows and the copy for evidence and empty states. */
export interface SalesActivityRowsView {
    readonly label: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly rows: ReadonlyArray<ActivityItemView>
    readonly evidenceTitle: string
    readonly byPolicy: string
}
/** Adds the activity introduction to its resolved rows. */
export interface SalesActivityView extends SalesActivityRowsView {
    readonly intro: string
}
/** Combines the order read with pagination state and labels. */
export interface SalesOrdersView extends SlotPanelProps<ReadonlyArray<SalesOrderRowView>> {
    readonly title: string
    readonly hasNextPage: boolean
    readonly isLoadingMore: boolean
    readonly paginationFailure: string | null
    readonly loadMoreLabel: string
    readonly retryLabel: string
}
/** Resolved read models for the Sales drawing; command protocols are separate. */
export interface SalesWorkbenchViewData {
    readonly why: WorkbenchExplanationView
    readonly regions: WorkbenchDashboardRegions
    readonly selectedTab: (typeof SALES_WORKBENCH_TABS)[number] | "conversation"
    readonly tabsLabel: string
    readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly gate: SlotPanelProps<boolean> & { readonly name: string }
    readonly ribbon: WorkbenchFigureRegion
    readonly waiting: WorkbenchWaitingCardView
    readonly attention: SalesAttentionView
    readonly pipeline: SalesPipelineView
    readonly decisions: SalesDecisionsView
    readonly handoffs: SalesHandoffsView
    readonly orders: SalesOrdersView
    readonly contracts: SalesContractsView
    readonly activity: SalesActivityView
    readonly inbox: SlotPanelProps<ChatbotConversationView>
}
