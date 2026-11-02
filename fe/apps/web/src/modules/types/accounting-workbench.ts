import type { AccountingQuestionsView, AccountingQuestionsActions } from "./accounting-question-card"
import type { WorkbenchDashboardRegions, WorkbenchExplanationView, WorkbenchFigureRegion } from "./workbench-dashboard"
import type { SlotPanelProps } from "./slot"
/** AccountingRecordData resolved data. */
export interface AccountingRecordData {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly amount: string
    readonly footnote: string
    readonly badges: ReadonlyArray<{
        readonly id: string
        readonly label: string
        readonly tone: "neutral" | "success" | "warning" | "accent"
        readonly isDot: boolean
    }>
}
/** AccountingRecordListData resolved data. */
/** AccountingRecordListData resolved data. */
export interface AccountingRecordListData {
    readonly label: string
    readonly empty: string
    readonly emptyBody: string
    readonly records: ReadonlyArray<AccountingRecordData>
}
interface AccountingOverviewWeek {
    readonly id: string
    readonly label: string
    readonly total: number
    readonly reading: string
}
interface AccountingOverviewAgeing {
    readonly id: string
    readonly label: string
    readonly total: number
    readonly reading: string
    readonly tone: "neutral" | "cautionary" | "negative"
}
/** Resolved period, ageing and weekly figures. */
export interface AccountingOverviewData {
    readonly title: string
    readonly intro: string
    readonly periodLabel: string
    readonly periodItems: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly selectedPeriod: string
    readonly excludedNote: string | null
    /** The ageing card names its moment; it is not a period of the selector. */
    readonly ageingTitle: string
    readonly ageingIntro: string
    /** The one line that stands in for the ageing gauges while nothing is owed. */
    readonly ageingEmpty: string
    readonly ageingMax: number
    readonly ageing: ReadonlyArray<AccountingOverviewAgeing>
    /** The weekly card names the period it covers. */
    readonly trendTitle: string
    readonly trendIntro: string
    readonly trendSource: string
    /** The one line that stands in for the weekly gauges while the period has no income. */
    readonly trendEmpty: string
    readonly weekMax: number
    readonly weeks: ReadonlyArray<AccountingOverviewWeek>
}
interface EvidenceForm {
    readonly title: string
    readonly intro: string
    readonly amountLabel: string
    readonly amountHint: string | null
    readonly dateLabel: string
    readonly contentLabel: string
    readonly contentHint: string
    readonly payerLabel: string
    readonly noteLabel: string
    readonly saveLabel: string
    readonly cancelLabel: string
    readonly foot: string
    readonly amount: string
    /** yyyy-mm-dd */
    readonly date: string
    readonly maxDate: string
    readonly content: string
    readonly payer: string
    readonly note: string
    readonly isSaving: boolean
    readonly error: string | null
    readonly notice: string | null
}
interface EvidenceNeed {
    readonly title: string
    readonly body: string
    readonly badge: string
    readonly actionLabel: string
    readonly actionHref: string
}
/** Ready evidence records and local form values, without renderer slots. */
export interface AccountingEvidenceData {
    readonly creditsTitle: string
    readonly creditsIntro: string
    readonly creditsEmpty: string
    readonly creditsEmptyBody: string
    readonly credits: ReadonlyArray<AccountingRecordData>
    readonly invoicesTitle: string
    readonly invoicesIntro: string
    readonly invoicesEmpty: string
    readonly invoicesEmptyBody: string
    readonly internalNote: string
    readonly invoices: ReadonlyArray<AccountingRecordData>
    readonly ordersTitle: string
    readonly ordersIntro: string
    readonly ordersEmpty: string
    readonly ordersEmptyBody: string
    readonly orders: ReadonlyArray<AccountingRecordData>
    /** Supplier invoices need an invoice connector: drawn only while none is connected. */
    readonly supplierNeed: EvidenceNeed | null
    readonly isFormOpen: boolean
    readonly formOpenLabel: string
    readonly lists: {
        readonly credits: AccountingRecordListData
        readonly invoices: AccountingRecordListData
        readonly orders: AccountingRecordListData
    }
    readonly form: EvidenceForm
}
interface LedgerAdjustForm {
    readonly intro: string
    readonly noteLabel: string
    readonly noteHint: string
    readonly amountLabel: string
    readonly amountHint: string
    readonly saveLabel: string
    readonly cancelLabel: string
    readonly note: string
    readonly amount: string
    readonly isSaving: boolean
    readonly error: string | null
}
/** AccountingLedgerDrawerData resolved data. */
interface AccountingLineageData {
    readonly id: string
    readonly title: string
    readonly dateTime: string | null
    readonly timeLabel: string | null
    readonly kindLabel: string
    readonly isCorrection: boolean
    readonly amountText: string | null
    readonly statusText: string | null
    readonly detail: string | null
}

/** Provides the selected ledger record, its lineage, and available adjustment state. */
export interface AccountingLedgerDrawerData {
    readonly isOpen: boolean
    readonly title: string
    readonly closeLabel: string
    readonly lineageTitle: string
    readonly lineageIntro: string
    readonly subtitle: string | null
    readonly lineage: ReadonlyArray<AccountingLineageData>
    readonly adjustTitle: string
    readonly adjustMode: "notReady" | "managersOnly" | "form" | "button" | "unavailable"
    readonly notReadyText: string
    readonly managersOnlyText: string
    readonly unavailableText: string
    readonly openLabel: string
    readonly form: LedgerAdjustForm
}
/** Ready ledger rows and their addressed correction drawer. */
export interface AccountingLedgerData {
    readonly title: string
    readonly intro: string
    readonly foot: string
    readonly empty: string
    readonly emptyBody: string
    readonly filterLabel: string
    readonly filterItems: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly selectedFilter: string
    readonly records: ReadonlyArray<AccountingRecordData>
    readonly drawer: AccountingLedgerDrawerData
}
interface WaitingBasisView {
    readonly value: string
    readonly label: string
    readonly hint: string
}
interface AccountingWaitingRow {
    readonly id: string
    readonly title: string
    readonly summary: string
    /** Why the agent stopped and needs a person, in plain words. */
    readonly reason: string
    readonly status: string
    readonly tone: "danger" | "success" | "warning"
    readonly amount: string | null
    /** The member may decide this question now. */
    readonly canAct: boolean
    readonly isOpen: boolean
    readonly isBusy: boolean
    /** Approve stays off until the basis the question asks for is written. */
    readonly isApproveDisabled: boolean
    readonly basis: WaitingBasisView | null
    readonly approveLabel: string
    readonly rejectLabel: string
    /** Who the question waits for, said to a member who may not decide it. */
    readonly waitingLabel: string
    readonly error: string | null
}
/** AccountingWaitingData resolved data. */
export interface AccountingWaitingData {
    readonly title: string
    readonly moreLabel: string
    readonly moreHref: string
    readonly moreMenuLabel: string
    readonly emptyMessage: string
    readonly emptyBody: string
    readonly count: string | null
    readonly rows: ReadonlyArray<AccountingWaitingRow>
    readonly more: string | null
}
/** AccountingUpcomingData resolved data. */
export interface AccountingUpcomingData {
    readonly title: string
    readonly emptyMessage: string
    readonly emptyBody: string
    readonly openBrainLabel: string
    readonly isUnknown: boolean
    readonly note: string | null
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly title: string
        readonly description: string
        readonly badge: string
        readonly tone: "danger" | "warning" | "neutral"
    }>
}
/** AccountingWorkbenchDataView resolved data. */
export interface AccountingWorkbenchDataView {
    readonly why: WorkbenchExplanationView
    readonly regions: WorkbenchDashboardRegions
    readonly tabsLabel: string
    readonly selectedTab: string
    readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly ribbon: WorkbenchFigureRegion
    readonly waiting: SlotPanelProps<AccountingWaitingData>
    readonly upcoming: SlotPanelProps<AccountingUpcomingData>
    readonly overview: SlotPanelProps<AccountingOverviewData>
    readonly evidence: SlotPanelProps<AccountingEvidenceData>
    readonly ledger: SlotPanelProps<AccountingLedgerData>
    readonly questions: SlotPanelProps<AccountingQuestionsView["props"]>
}
/** AccountingWorkbenchActions resolved data. */
export interface AccountingWorkbenchActions {
    readonly selectTab: (key: string) => void
    readonly closeWhy: () => void
    readonly retryDashboard: () => void
    readonly retry: () => void
    readonly waiting: {
        readonly approve: (id: string) => void
        readonly reject: (id: string) => void
        readonly changeBasis: (id: string, value: string) => void
    }
    readonly upcoming: { readonly openBrain: () => void }
    readonly overview: { readonly selectPeriod: (key: string) => void }
    readonly evidence: {
        readonly openForm: () => void
        readonly closeForm: () => void
        readonly changeField: (name: "amount" | "date" | "content" | "payer" | "note", value: string) => void
        readonly submitForm: () => void
    }
    readonly ledger: {
        readonly selectFilter: (key: string) => void
        readonly openEntry: (id: string) => void
        readonly closeDrawer: () => void
        readonly startAdjust: () => void
        readonly cancelAdjust: () => void
        readonly changeNote: (value: string) => void
        readonly changeAmount: (value: string) => void
        readonly submitAdjust: () => void
    }
    readonly questions: AccountingQuestionsActions
}

/** The original workbench areas in route and display order. */
export const ACCOUNTING_TABS = ["overview", "evidence", "questions", "ledger"] as const
