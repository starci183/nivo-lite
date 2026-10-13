import type { LeadDecisionRecord as DecisionRow } from "@modules/domain/decisions"
import type { InvoiceViewRow as Invoice } from "@modules/domain/invoices"
import type { OrdersWorkbenchRow as Order } from "@modules/domain/orders"
import type { EvidenceState, ReasonCode } from "@modules/domain/work-items"
import type { ContractResult } from "@modules/domain/contracts"
import type { WorkItemView } from "./work-item-view.contracts"

/** A module action key. */
type FlowAction = string
/** A lead journey stage. */
export type LeadStageId = string

/** What needs a person on the Sales workbench. */
export type AttentionKind = "decision" | "failed" | "clarify" | "overdue" | "awaiting_reply"

/** One opportunity that needs a person: what is needed, since when, who owns it and the one primary action. */
export interface AttentionRow {
    /** key. */
    readonly key: string
    /** kind. */
    readonly kind: AttentionKind
    /** leadId. */
    readonly leadId: string | null
    /** customer. */
    readonly customer: string
    /** company. */
    readonly company: string
    /** stage. */
    readonly stage: LeadStageId | null
    /** The need in one line: what NIVO proposes, the missing data, the overdue step or the last customer message. */
    readonly need: string
    /** since. */
    readonly since: string
    /** owner. */
    readonly owner: string | null
    /** workItemId. */
    readonly workItemId: string | null
    /** The pending decision this row opens in the Decisions surface (work item or legacy approval card). */
    readonly decisionId: string | null
    /** action. */
    readonly action: FlowAction | null
    /** The fields NIVO is missing (clarification). */
    readonly missing: ReadonlyArray<string>
}

/** A card on the pipeline board. */
export interface SalesDeal {
    /** leadId. */
    readonly leadId: string
    /** customer. */
    readonly customer: string
    /** company. */
    readonly company: string
    /** channel. */
    readonly channel: string
    /** need. */
    readonly need: string
    /** stage. */
    readonly stage: LeadStageId
    /** valueVnd. */
    readonly valueVnd: number | null
    /** valueSource. */
    readonly valueSource: "order" | "quote" | null
    /** nextStep. */
    readonly nextStep: string | null
    /** dueAt. */
    readonly dueAt: string | null
    /** owner. */
    readonly owner: string | null
    /** createdAt. */
    readonly createdAt: string
    /** Why the deal was closed (won or lost), from the outcome evidence; null while open. */
    readonly closedReason: string | null
    /** closedAt. */
    readonly closedAt: string | null
}

/** One decision waiting on the Sales workbench. */
export interface SalesDecision {
    /** id. */
    readonly id: string
    /** source. */
    readonly source: "work_item" | "execution"
    /** workItemId. */
    readonly workItemId: string | null
    /** executionId. */
    readonly executionId: string | null
    /** leadId. */
    readonly leadId: string | null
    /** customer. */
    readonly customer: string
    /** action. */
    readonly action: FlowAction | "follow_up"
    /** reason. */
    readonly reason: ReasonCode | null
    /** summary. */
    readonly summary: string
    /** draft. */
    readonly draft: string
    /** amountVnd. */
    readonly amountVnd: number | null
    /** True when the amount is part of what the person can set (a quote or an order). */
    readonly hasAmount: boolean
    /** missing. */
    readonly missing: ReadonlyArray<string>
    /** assignedStaffId. */
    readonly assignedStaffId: string | null
    /** assignedStaffName. */
    readonly assignedStaffName: string | null
    /** createdAt. */
    readonly createdAt: string
}

/** One hand-off row of the Accounting hand-off surface. */
export interface HandoffRow {
    /** key. */
    readonly key: string
    /** orderId. */
    readonly orderId: string | null
    /** leadId. */
    readonly leadId: string | null
    /** customer. */
    readonly customer: string
    /** orderNo. */
    readonly orderNo: string | null
    /** items. */
    readonly items: string
    /** amountVnd. */
    readonly amountVnd: number | null
    /** orderStatus. */
    readonly orderStatus: Order["status"] | "won_without_order"
    /** confirmedAt. */
    readonly confirmedAt: string | null
    /** invoice. */
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
    /** canHandoff. */
    readonly canHandoff: boolean
    /** Shipping state (set by the mark-shipped action); canShip is true for a confirmed, not yet shipped order. */
    readonly shippedAt: string | null
    /** carrier. */
    readonly carrier: string | null
    /** trackingCode. */
    readonly trackingCode: string | null
    /** canShip. */
    readonly canShip: boolean
}

/** One thing NIVO did by policy, with the evidence behind it. */
export interface AutoActivity {
    /** id. */
    readonly id: string
    /** action. */
    readonly action: FlowAction
    /** leadId. */
    readonly leadId: string | null
    /** customer. */
    readonly customer: string | null
    /** summary. */
    readonly summary: string
    /** at. */
    readonly at: string
    /** evidenceState. */
    readonly evidenceState: EvidenceState
    /** evidence. */
    readonly evidence: string | null
    /** href. */
    readonly href: string
}

/** Conversion of the leads created in the window (test runs left out): how many reached won, overall and per source. */
export interface SalesConversion {
    /** windowDays. */
    readonly windowDays: number
    /** leads. */
    readonly leads: number
    /** won. */
    readonly won: number
    /** One entry per source (the lead channel), the most leads first. */
    readonly sources: ReadonlyArray<SalesSourceConversion>
}

/** The header figures of the Sales workbench. */
export interface SalesMetrics {
    /** openCount. */
    readonly openCount: number
    /** proposalValueVnd. */
    readonly proposalValueVnd: number
    /** proposalCount. */
    readonly proposalCount: number
    /** wonCount. */
    readonly wonCount: number
    /** wonValueVnd. */
    readonly wonValueVnd: number
    /** waitingCount. */
    readonly waitingCount: number
    /** conversion. */
    readonly conversion: SalesConversion
}

/** Everything the Sales workbench reads. */
export interface SalesWorkbenchData {
    /** nowIso. */
    readonly nowIso: string
    /** metrics. */
    readonly metrics: SalesMetrics
    /** attention. */
    readonly attention: ReadonlyArray<AttentionRow>
    /** deals. */
    readonly deals: ReadonlyArray<SalesDeal>
    /** Closed deals beyond the per-column limit of the board (so it can say "N more"). */
    readonly closedHidden: SalesClosedHidden
    /** decisions. */
    readonly decisions: ReadonlyArray<SalesDecision>
    /** decided. */
    readonly decided: ReadonlyArray<DecisionRow>
    /** handoffs. */
    readonly handoffs: ReadonlyArray<HandoffRow>
    /** activity. */
    readonly activity: ReadonlyArray<AutoActivity>
    /** staff. */
    readonly staff: ReadonlyArray<{ readonly id: string; readonly name: string }>
    /** Recurring contracts, soonest end first (active ones before ended and cancelled). */
    readonly contracts: ReadonlyArray<ContractResult>
    /** Customers a contract can be linked to. */
    readonly leadOptions: ReadonlyArray<{ readonly id: string; readonly name: string }>
}

/** The closed pipeline cards hidden beyond the board limit. */
export interface SalesClosedHidden {
    /** Won cards beyond the limit. */
    readonly won: number
    /** Lost cards beyond the limit. */
    readonly lost: number
}

/** Conversion for one source. */
export interface SalesSourceConversion {
    /** The source channel. */
    readonly source: string
    /** The leads created in the window. */
    readonly leads: number
    /** Those now won. */
    readonly won: number
}
