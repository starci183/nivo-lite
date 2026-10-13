import type { DecisionRow, EvidenceState, FlowAction, Invoice, Order, ReasonCode, WorkItemView } from "@/lib/flow-types"
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
    readonly action: FlowAction | null
    /** The fields NIVO is missing (clarification). */
    readonly missing: ReadonlyArray<string>
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
    readonly action: FlowAction | "follow_up"
    readonly reason: ReasonCode | null
    readonly summary: string
    readonly draft: string
    readonly amountVnd: number | null
    /** True when the amount is part of what the person can set (a quote or an order). */
    readonly hasAmount: boolean
    readonly missing: ReadonlyArray<string>
    readonly assignedStaffId: string | null
    readonly assignedStaffName: string | null
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
    readonly orderStatus: Order["status"] | "won_without_order"
    readonly confirmedAt: string | null
    readonly invoice: {
        readonly no: string
        readonly status: Invoice["status"]
        readonly amountVnd: number
        readonly issuedAt: string | null
        readonly paidAt: string | null
    } | null
    /** The accounting step for this order (invoice) when one exists. */
    readonly work: {
        readonly id: string
        readonly status: WorkItemView["status"]
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
    readonly action: FlowAction
    readonly leadId: string | null
    readonly customer: string | null
    readonly summary: string
    readonly at: string
    readonly evidenceState: EvidenceState
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
    readonly decided: ReadonlyArray<DecisionRow>
    readonly handoffs: ReadonlyArray<HandoffRow>
    readonly activity: ReadonlyArray<AutoActivity>
    readonly staff: ReadonlyArray<{ readonly id: string; readonly name: string }>
    /** Recurring contracts, soonest end first (active ones before ended and cancelled). */
    readonly contracts: ReadonlyArray<SalesContract>
    /** Customers a contract can be linked to. */
    readonly leadOptions: ReadonlyArray<{ readonly id: string; readonly name: string }>
}
