import type { FlowDecisionRow, FlowEvidenceState, FlowInvoice, FlowOrder, ReasonCode, FlowWorkItemView } from "./flow"
import type { LeadStageId } from "./leads"

/** What needs a person on the Sales workbench. */
export type AttentionKind = "decision" | "failed" | "clarify" | "overdue" | "awaiting_reply"

/** One opportunity that needs a person: what is needed, since when, who owns it and the one primary action. */
export interface AttentionRow {
    readonly key: string
    readonly kind: AttentionKind
    readonly leadId: string | null
    readonly customer: string
    readonly company: string
    readonly stage: LeadStageId | null
    /** The need in one line: what NIVO proposes, the missing data, the overdue step or the last customer message. */
    readonly need: string
    readonly since: string
    readonly owner: string | null
    readonly workItemId: string | null
    /** The pending decision this row opens in the Decisions surface (work item or legacy approval card). */
    readonly decisionId: string | null
    readonly action: string | null
    /** The fields NIVO is missing (clarification). */
    readonly missing: ReadonlyArray<string>
    /** The newest conversation of the customer, which the row opens beside the thread; null while the customer never wrote. */
    readonly conversationId: string | null
}

/** A card on the pipeline board. */
export interface SalesDeal {
    readonly leadId: string
    readonly customer: string
    readonly company: string
    readonly channel: string
    readonly need: string
    readonly stage: LeadStageId
    readonly valueVnd: number | null
    readonly valueSource: "order" | "quote" | null
    readonly nextStep: string | null
    readonly dueAt: string | null
    readonly owner: string | null
    readonly createdAt: string
    /** Why the deal was closed (won or lost), from the outcome evidence; null while open. */
    readonly closedReason: string | null
    readonly closedAt: string | null
}

/** One decision waiting on the Sales workbench. */
export interface SalesDecision {
    readonly id: string
    readonly source: "work_item" | "execution"
    readonly workItemId: string | null
    readonly executionId: string | null
    readonly leadId: string | null
    readonly customer: string
    readonly action: string
    readonly reason: ReasonCode | null
    readonly summary: string
    readonly draft: string
    readonly amountVnd: number | null
    /** True when the amount is part of what the person can set (a quote or an order). */
    readonly hasAmount: boolean
    readonly missing: ReadonlyArray<string>
    readonly assignedStaffId: string | null
    readonly assignedStaffName: string | null
    /** The newest conversation of the customer; the decision waits under its last message. */
    readonly conversationId: string | null
    readonly createdAt: string
}

/** One hand-off row of the Accounting hand-off surface. */
export interface HandoffRow {
    readonly key: string
    readonly orderId: string | null
    readonly leadId: string | null
    readonly customer: string
    readonly orderNo: string | null
    readonly items: string
    readonly amountVnd: number | null
    readonly orderStatus: FlowOrder["status"] | "won_without_order"
    readonly confirmedAt: string | null
    readonly invoice: {
        readonly no: string
        readonly status: FlowInvoice["status"]
        readonly amountVnd: number
        readonly issuedAt: string | null
        readonly paidAt: string | null
    } | null
    /** The accounting step for this order (invoice) when one exists. */
    readonly work: {
        readonly id: string
        readonly status: FlowWorkItemView["status"]
        readonly reason: ReasonCode | null
        readonly error: string | null
    } | null
    readonly canHandoff: boolean
    /** Shipping state (set by the mark-shipped action); canShip is true for a confirmed, not yet shipped order. */
    readonly shippedAt: string | null
    readonly carrier: string | null
    readonly trackingCode: string | null
    readonly canShip: boolean
}

/** One thing NIVO did by policy, with the evidence behind it. */
export interface AutoActivity {
    readonly id: string
    readonly action: string
    readonly leadId: string | null
    readonly customer: string | null
    readonly summary: string
    readonly at: string
    readonly evidenceState: FlowEvidenceState
    readonly evidence: string | null
    readonly href: string
}

/** Conversion of the leads created in the window (test runs left out): how many reached won, overall and per source. */
export interface SalesConversion {
    readonly windowDays: number
    readonly leads: number
    readonly won: number
    /** One entry per source (the lead channel), the most leads first. */
    readonly sources: ReadonlyArray<{ readonly source: string; readonly leads: number; readonly won: number }>
}

/** The header figures of the Sales workbench. */
export interface SalesMetrics {
    readonly openCount: number
    readonly proposalValueVnd: number
    readonly proposalCount: number
    readonly wonCount: number
    readonly wonValueVnd: number
    readonly waitingCount: number
    readonly conversion: SalesConversion
}

/** The statuses a recurring sales contract can hold. */
export type SalesContractStatus = "active" | "ended" | "cancelled"

/** One recurring sales contract. */
export interface SalesContract {
    readonly id: string
    readonly lead_id: string | null
    readonly customer_name: string
    readonly plan: string
    /** YYYY-MM-DD. */
    readonly starts_on: string
    /** YYYY-MM-DD. */
    readonly ends_on: string
    readonly amount_vnd: number | null
    readonly status: SalesContractStatus
    readonly note: string
}

/** Everything the Sales workbench reads. */
export interface SalesWorkbenchData {
    readonly nowIso: string
    readonly metrics: SalesMetrics
    readonly attention: ReadonlyArray<AttentionRow>
    readonly deals: ReadonlyArray<SalesDeal>
    /** Closed deals beyond the per-column limit of the board (so it can say "N more"). */
    readonly closedHidden: { readonly won: number; readonly lost: number }
    readonly decisions: ReadonlyArray<SalesDecision>
    readonly decided: ReadonlyArray<FlowDecisionRow>
    readonly handoffs: ReadonlyArray<HandoffRow>
    readonly activity: ReadonlyArray<AutoActivity>
    readonly staff: ReadonlyArray<{ readonly id: string; readonly name: string }>
    /** Recurring contracts, soonest end first (active ones before ended and cancelled). */
    readonly contracts: ReadonlyArray<SalesContract>
    /** Customers a contract can be linked to. */
    readonly leadOptions: ReadonlyArray<{ readonly id: string; readonly name: string }>
}

import type { BadgeTone } from "@starci/grammar/common"

/** One data field NIVO is missing and the person fills in. */
interface MissingFieldView {
    readonly name: string
    readonly label: string
    readonly value: string
}

/** One pending decision, every word and flag already resolved. */
export interface DecisionRowView {
    readonly id: string
    readonly anchor: string
    readonly isFocused: boolean
    readonly badge: string
    readonly age: string
    readonly isStale: boolean
    readonly customer: string
    readonly leadHref: string | null
    readonly actionLabel: string
    readonly summary: string
    readonly reasonHint: string | null
    readonly amountLine: string | null
    readonly draft: string | null
    readonly canAct: boolean
    readonly assignedTo: string | null
    readonly missing: ReadonlyArray<MissingFieldView>
    readonly isEditing: boolean
    readonly draftValue: string
    readonly showDraftField: boolean
    readonly amountValue: string
    readonly showAmountField: boolean
    readonly canEdit: boolean
    /** True while a decision is in flight: every command waits. */
    readonly isBusy: boolean
    readonly isApproveBusy: boolean
    readonly isRejectBusy: boolean
    readonly isApproveDisabled: boolean
    readonly editLabel: string
    readonly error: string | null
}

/** The words every pending decision shares. */
export interface DecisionRowLabels {
    readonly draftLabel: string
    readonly waitingManager: string
    readonly amountLabel: string
    readonly approveLabel: string
    readonly rejectLabel: string
}

/** What a person can do with one pending decision; every argument is an atom. */
export interface DecisionRowActions {
    readonly field: (id: string, name: string, value: string) => void
    readonly draft: (id: string, value: string) => void
    readonly amount: (id: string, value: string) => void
    readonly toggleEdit: (id: string) => void
    readonly decide: (id: string, decision: "approved" | "rejected") => void
}

/** One opportunity that needs a person, every word already resolved. */
export interface AttentionItemView {
    readonly key: string
    readonly kind: "decision" | "clarify" | "failed" | "overdue" | "awaiting_reply"
    readonly kindLabel: string
    readonly kindTone: BadgeTone
    readonly stage: {
        readonly label: string
        readonly tone: BadgeTone
    } | null
    readonly age: string
    readonly isStale: boolean
    readonly customer: string
    readonly leadHref: string | null
    readonly title: string | null
    readonly need: string
    readonly owner: string
    /** Where the decision of this row is made: the Decisions tab opened on it. */
    readonly decisionHref: string | null
    readonly workItemId: string | null
    readonly error: string | null
    readonly isRetryBusy: boolean
    readonly isStopBusy: boolean
}

/** One thing NIVO did by policy, every word already resolved. */
export interface ActivityItemView {
    readonly id: string
    readonly action: string
    readonly evidenceLabel: string
    readonly evidenceTone: BadgeTone
    readonly when: string
    readonly customer: string
    readonly href: string
    readonly summary: string
    readonly evidence: string | null
}

/** One deal card, every word already resolved. */
export interface DealView {
    readonly leadId: string
    readonly href: string
    readonly customer: string
    readonly company: string
    readonly value: string
    readonly source: string | null
    readonly nextLine: string
    readonly isClosed: boolean
    readonly facts: string
}

/** One stage lane. */
export interface LaneView {
    readonly stage: string
    readonly title: string
    readonly fact: string
    readonly hiddenText: string | null
    readonly deals: ReadonlyArray<DealView>
}

/** The dialog that moves a deal to another stage. */
export interface MoveDialogView {
    readonly title: string
    readonly description: string | undefined
    readonly options: ReadonlyArray<{
        readonly value: string
        readonly label: string
    }>
    readonly target: string
    readonly isDanger: boolean
    readonly reasonLabel: string | null
    readonly reasonHint: string | undefined
    readonly reasonRequired: boolean
    readonly reason: string
    readonly wonNote: string | null
    readonly error: string | null
    readonly isIncomplete: boolean
}

/** One order or won deal and where its invoice stands, every word already resolved. */
export interface HandoffItemView {
    readonly key: string
    readonly orderId: string | null
    readonly orderLabel: string
    readonly orderTone: BadgeTone
    readonly invoiceLabel: string
    readonly invoiceTone: BadgeTone
    readonly confirmed: string | null
    readonly customer: string
    readonly leadHref: string | null
    readonly detail: string
    readonly amount: string
    readonly invoiceLine: string | null
    readonly shippedLine: string | null
    readonly workText: string | null
    readonly errorText: string | null
    readonly hint: string | null
    readonly note: string | null
    readonly error: string | null
    readonly canRun: boolean
    readonly runLabel: string
    readonly canShip: boolean
    readonly isRunBusy: boolean
}

/** The confirmed order the shipping drawer is open for. */
export interface SalesShipping {
    readonly key: string
    readonly orderId: string
    readonly orderNo: string | null
    readonly customer: string
}

/** One order in the history with its display text resolved. */
export interface SalesOrderRowView {
    readonly id: string
    readonly number: string
    readonly items: string
    readonly leadHref: string | null
    readonly status: string
    readonly amount: string
    readonly createdAt: string
}

/** One recurring contract, every word already resolved. */
export interface ContractItemView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly when: {
        readonly text: string
        readonly tone: BadgeTone
    } | null
}

/** One decision already made, every word already resolved. */
export interface DecidedView {
    readonly id: string
    readonly action: string
    readonly outcomeLabel: string
    readonly outcomeTone: BadgeTone
    readonly customer: string
    readonly href: string | null
    readonly byline: string
    readonly basis: string | null
    readonly rest: string | null
}
