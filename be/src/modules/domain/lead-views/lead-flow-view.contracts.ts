import type { LeadDecisionRecord as DecisionRecord } from "@modules/domain/decisions"
import type { InvoiceViewRow } from "@modules/domain/invoices"
import type { LeadView } from "@modules/domain/leads"
import type { OrdersWorkbenchRow } from "@modules/domain/orders"
import type { StaffRecord } from "@modules/domain/staff"
import type { TransactionViewRow } from "@modules/domain/transactions"
import type { WorkItem } from "@modules/domain/work-items"

/** The owner records and display references needed to compose one lead's journey. */
export interface LeadFlowRecords {
    /** The customer's chronological work items. */
    readonly workItems: ReadonlyArray<WorkItem>
    /** The workspace-scoped customer. */
    readonly lead: LeadView
    /** Names of the staff assigned to these work items. */
    readonly staff: ReadonlyArray<StaffRecord>
    /** The customer's orders. */
    readonly orders: ReadonlyArray<OrdersWorkbenchRow>
    /** The customer's invoices. */
    readonly invoices: ReadonlyArray<InvoiceViewRow>
    /** Payments attached to those invoices. */
    readonly transactions: ReadonlyArray<TransactionViewRow>
    /** The chronological decision history. */
    readonly decisions: ReadonlyArray<DecisionRecord>
}

/** The work, commercial records and decisions connected to one lead. */
export interface LeadFlowView {
    /** Work items enriched with lead and assignment display details. */
    readonly workItems: Array<LeadFlowWorkItemView>

    /** Sales orders connected to the lead. */
    readonly orders: Array<LeadFlowOrderView>

    /** Invoices connected to the lead. */
    readonly invoices: Array<LeadFlowInvoiceView>

    /** Payment transactions connected through the lead invoices. */
    readonly transactions: Array<LeadFlowTransactionView>

    /** Policy and human decisions recorded for the lead. */
    readonly decisions: Array<LeadFlowDecisionView>
}

/** A candidate commercial record proposed for a work item. */
export interface LeadFlowCandidateView {
    /** The id of the candidate record. */
    readonly id: string

    /** The display label used to choose the candidate. */
    readonly label: string

    /** The candidate amount in Vietnamese dong. */
    readonly amountVnd: number
}

/** A policy or human decision recorded in the lead flow. */
export interface LeadFlowDecisionView {
    /** The decision id. */
    readonly id: string

    /** The work item affected by this decision. */
    readonly workItemId: string | null

    /** The lead affected by this decision. */
    readonly leadId: string | null

    /** The lead contact name shown in decision history. */
    readonly leadName: string | null

    /** The department responsible for the decided action. */
    readonly department: string

    /** The registered action covered by the decision. */
    readonly action: string

    /** The policy or person that made the decision. */
    readonly decidedBy: string

    /** The kind of decider: policy, owner or staff. */
    readonly deciderKind: string

    /** The outcome: auto_done, approved, edited or rejected. */
    readonly outcome: string

    /** The reason code recorded with the decision. */
    readonly reason: string | null

    /** The optional note recorded by the decider. */
    readonly note: string | null

    /** When the decision was recorded, in ISO 8601 format. */
    readonly createdAt: string
}

/** An invoice in the lead's commercial flow. */
export interface LeadFlowInvoiceView {
    /** The invoice id. */
    readonly id: string

    /** The workspace that owns the invoice. */
    readonly workspaceId: string

    /** The order billed by this invoice. */
    readonly orderId: string | null

    /** The lead connected to this invoice. */
    readonly leadId: string | null

    /** The human-readable invoice number. */
    readonly invoiceNo: string

    /** The invoice amount in Vietnamese dong. */
    readonly amountVnd: number

    /** When payment is due, in ISO 8601 format. */
    readonly dueAt: string | null

    /** The invoice's current commercial status. */
    readonly status: string

    /** Whether the invoice originated from live or simulated input. */
    readonly origin: string

    /** The identity that issued the invoice. */
    readonly issuedBy: string | null

    /** When the invoice was issued, in ISO 8601 format. */
    readonly issuedAt: string | null

    /** When the invoice was paid, in ISO 8601 format. */
    readonly paidAt: string | null

    /** When the invoice was created, in ISO 8601 format. */
    readonly createdAt: string
}

/** The lead display details attached to a work item. */
export interface LeadFlowLeadView {
    /** The linked lead id. */
    readonly id: string

    /** The name of the lead contact. */
    readonly contactName: string

    /** The company associated with the contact. */
    readonly company: string

    /** The channel through which the lead arrived. */
    readonly channel: string
}

/** A sales order in the lead's commercial flow. */
export interface LeadFlowOrderView {
    /** The order id. */
    readonly id: string

    /** The workspace that owns the order. */
    readonly workspaceId: string

    /** The lead connected to the order. */
    readonly leadId: string | null

    /** The inbound event that created the order. */
    readonly inboundEventId: string | null

    /** The human-readable order number. */
    readonly orderNo: string

    /** The order's item description. */
    readonly items: string

    /** The order amount in Vietnamese dong. */
    readonly amountVnd: number | null

    /** The order's current commercial status. */
    readonly status: string

    /** Whether the order originated from live or simulated input. */
    readonly origin: string

    /** The identity that confirmed the order. */
    readonly confirmedBy: string | null

    /** When the order was confirmed, in ISO 8601 format. */
    readonly confirmedAt: string | null

    /** When the order was created, in ISO 8601 format. */
    readonly createdAt: string

    /** When the order was marked shipped, in ISO 8601 format. */
    readonly shippedAt: string | null

    /** The carrier responsible for delivering the order. */
    readonly carrier: string | null

    /** The shipment tracking code. */
    readonly trackingCode: string | null
}

/** The proposed action and supporting values awaiting execution or review. */
export interface LeadFlowProposalView {
    /** A human-readable explanation of the proposed action. */
    readonly summary: string

    /** The draft content to send or apply. */
    readonly draft: string | null

    /** The proposed amount in Vietnamese dong. */
    readonly amountVnd: number | null

    /** Dynamic proposal values represented as typed key-value entries. */
    readonly fields: Array<LeadFlowProposalFieldView>

    /** The confidence reported when the proposal was created. */
    readonly confidence: number | null

    /** Whether the proposed outcome is clear or unclear. */
    readonly outcome: string | null

    /** Candidate records available for a reviewer to choose. */
    readonly candidates: Array<LeadFlowCandidateView> | null
}

/** One typed value from a proposal's dynamic field map. */
export interface LeadFlowProposalFieldView {
    /** The original key in the proposal field map. */
    readonly key: string

    /** The value kind: string, number or null. */
    readonly kind: string

    /** The value when its kind is string. */
    readonly stringValue: string | null

    /** The value when its kind is number. */
    readonly numberValue: number | null
}

/** The recorded outcome of a completed work item. */
export interface LeadFlowResultView {
    /** A human-readable explanation of the completed action. */
    readonly summary: string

    /** The destination for inspecting the resulting record. */
    readonly href: string | null
}

/** A payment transaction connected to the lead's invoices. */
export interface LeadFlowTransactionView {
    /** The transaction id. */
    readonly id: string

    /** The workspace that owns the transaction. */
    readonly workspaceId: string

    /** The inbound event that recorded the payment. */
    readonly inboundEventId: string | null

    /** The payment channel: bank, cash, card or ewallet. */
    readonly channel: string

    /** The transaction amount in Vietnamese dong. */
    readonly amountVnd: number

    /** The payment or bank reference. */
    readonly reference: string | null

    /** The name or identity supplied by the payer. */
    readonly payer: string | null

    /** When the payment occurred, in ISO 8601 format. */
    readonly occurredAt: string

    /** The invoice matched to this transaction. */
    readonly invoiceId: string | null

    /** The current matching or review status. */
    readonly status: string

    /** Whether the transaction originated from live or simulated input. */
    readonly origin: string

    /** When the transaction was recorded, in ISO 8601 format. */
    readonly createdAt: string
}

/** A work item with the display details required by the lead flow. */
export interface LeadFlowWorkItemView {
    /** The work item id. */
    readonly id: string

    /** The workspace that owns the work item. */
    readonly workspaceId: string

    /** The department responsible for executing the action. */
    readonly department: string

    /** The registered action assigned to this work item. */
    readonly action: string

    /** The kind of record the action operates on. */
    readonly subjectType: string

    /** The record the action operates on, when available. */
    readonly subjectId: string | null

    /** The lead associated with this work item. */
    readonly leadId: string | null

    /** The inbound event that initiated the work. */
    readonly inboundEventId: string | null

    /** The preceding work item in the command chain. */
    readonly parentId: string | null

    /** The root work item that identifies the command chain. */
    readonly chainId: string | null

    /** The number of hops from the root work item. */
    readonly depth: number

    /** The current execution or review status. */
    readonly status: string

    /** Whether the action was decided automatically or by a human. */
    readonly decidedPath: string | null

    /** The primary reason code for the current decision state. */
    readonly reason: string | null

    /** All reason codes produced by the authority gate. */
    readonly reasons: Array<string>

    /** The input fields still required before execution. */
    readonly missingFields: Array<string>

    /** The proposed action and its supporting values. */
    readonly proposal: LeadFlowProposalView

    /** The recorded outcome once the action completes. */
    readonly result: LeadFlowResultView | null

    /** The recorded failure detail, when execution failed. */
    readonly error: string | null

    /** The current evidence capture and verification state. */
    readonly evidenceState: string

    /** The staff member assigned to the action. */
    readonly assignedStaffId: string | null

    /** The linked execution record, when present. */
    readonly executionId: string | null

    /** Whether the work originated from live or simulated input. */
    readonly origin: string

    /** When the work item was created, in ISO 8601 format. */
    readonly createdAt: string

    /** When the work item was last updated, in ISO 8601 format. */
    readonly updatedAt: string

    /** When execution completed, in ISO 8601 format. */
    readonly completedAt: string | null

    /** The agent installation responsible for the work. */
    readonly installationId: string | null

    /** The lead contact details shown beside the work item. */
    readonly lead: LeadFlowLeadView | null

    /** The display name of the assigned staff member. */
    readonly assignedStaffName: string | null

    /** Whether an existing execution approval card already displays this item. */
    readonly hasApprovalCard: boolean

    /** The destination for inspecting or acting on this work item. */
    readonly href: string

    /** The identity that made the latest decision, when requested. */
    readonly decidedBy: string | null
}
