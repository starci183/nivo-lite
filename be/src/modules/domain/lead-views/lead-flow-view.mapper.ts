import type { LeadView } from "@modules/domain/leads"
import type { StaffRecord } from "@modules/domain/staff"
import type {
    LeadFlowDecisionView,
    LeadFlowInvoiceView,
    LeadFlowOrderView,
    LeadFlowProposalView,
    LeadFlowRecords,
    LeadFlowTransactionView,
    LeadFlowView,
    LeadFlowWorkItemView,
} from "./lead-flow-view.contracts"
import type { DecisionRecord } from "@modules/domain/decisions"
import type { InvoiceViewRow } from "@modules/domain/invoices"
import type { OrdersWorkbenchRow } from "@modules/domain/orders"
import type { TransactionViewRow } from "@modules/domain/transactions"
import type { Proposal, WorkItem } from "@modules/domain/work-items"

const toProposalView = (proposal: Proposal): LeadFlowProposalView => ({
    summary: proposal.summary,
    draft: proposal.draft ?? null,
    amountVnd: proposal.amount_vnd ?? null,
    fields: Object.entries(proposal.fields).map(([key, value]) => ({
        key,
        kind: value === null ? "null" : typeof value,
        stringValue: typeof value === "string" ? value : null,
        numberValue: typeof value === "number" ? value : null,
    })),
    confidence: proposal.confidence ?? null,
    outcome: proposal.outcome ?? null,
    candidates: (proposal.candidates ?? []).map((candidate) => ({
        id: candidate.id,
        label: candidate.label,
        amountVnd: candidate.amount_vnd,
    })),
})

const toWorkItemView = (item: WorkItem, lead: LeadView, staff: ReadonlyArray<StaffRecord>): LeadFlowWorkItemView => ({
    id: item.id,
    workspaceId: item.workspace_id,
    department: item.department,
    action: item.action,
    subjectType: item.subject_type,
    subjectId: item.subject_id,
    leadId: item.lead_id,
    inboundEventId: item.inbound_event_id,
    parentId: item.parent_id,
    chainId: item.chain_id,
    depth: item.depth,
    status: item.status,
    decidedPath: item.decided_path,
    reason: item.reason,
    reasons: [...item.reasons],
    missingFields: [...item.missing_fields],
    proposal: toProposalView(item.proposal),
    result: item.result === null ? null : { summary: item.result.summary, href: item.result.href ?? null },
    error: item.error,
    evidenceState: item.evidence_state,
    assignedStaffId: item.assigned_staff_id,
    executionId: item.execution_id,
    origin: item.origin,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    completedAt: item.completed_at,
    installationId: item.installation_id,
    lead: { id: lead.id, contactName: lead.contact_name, company: lead.company, channel: lead.channel },
    assignedStaffName: staff.find((person) => person.id === item.assigned_staff_id)?.name ?? null,
    hasApprovalCard: item.execution_id !== null,
    href: `/leads/${lead.id}`,
    decidedBy: null,
})

const toOrderView = (order: OrdersWorkbenchRow): LeadFlowOrderView => ({
    id: order.id,
    workspaceId: order.workspace_id,
    leadId: order.lead_id,
    inboundEventId: order.inbound_event_id,
    orderNo: order.order_no,
    items: order.items,
    amountVnd: order.amount_vnd,
    status: order.status,
    origin: order.origin,
    confirmedBy: order.confirmed_by,
    confirmedAt: order.confirmed_at,
    createdAt: order.created_at,
    shippedAt: order.shipped_at,
    carrier: order.carrier,
    trackingCode: order.tracking_code,
})

const toInvoiceView = (invoice: InvoiceViewRow): LeadFlowInvoiceView => ({
    id: invoice.id,
    workspaceId: invoice.workspace_id,
    orderId: invoice.order_id,
    leadId: invoice.lead_id,
    invoiceNo: invoice.invoice_no,
    amountVnd: invoice.amount_vnd,
    dueAt: invoice.due_at,
    status: invoice.status,
    origin: invoice.origin,
    issuedBy: invoice.issued_by,
    issuedAt: invoice.issued_at,
    paidAt: invoice.paid_at,
    createdAt: invoice.created_at,
})

const toTransactionView = (transaction: TransactionViewRow): LeadFlowTransactionView => ({
    id: transaction.id,
    workspaceId: transaction.workspace_id,
    inboundEventId: transaction.inbound_event_id,
    channel: transaction.channel,
    amountVnd: transaction.amount_vnd,
    reference: transaction.reference,
    payer: transaction.payer,
    occurredAt: transaction.occurred_at,
    invoiceId: transaction.invoice_id,
    status: transaction.status,
    origin: transaction.origin,
    createdAt: transaction.created_at,
})

const toDecisionView = (decision: DecisionRecord): LeadFlowDecisionView => ({
    id: decision.id,
    workItemId: decision.work_item_id,
    leadId: decision.lead_id,
    leadName: decision.leadName,
    department: decision.department,
    action: decision.action,
    decidedBy: decision.decided_by,
    deciderKind: decision.decider_kind,
    outcome: decision.outcome,
    reason: decision.reason,
    note: decision.note,
    createdAt: decision.created_at,
})

/** Maps the composed owner reads to the typed GraphQL journey. */
export const toLeadFlowView = (result: LeadFlowRecords): LeadFlowView => ({
    workItems: result.workItems.map((item) => toWorkItemView(item, result.lead, result.staff)),
    orders: result.orders.map(toOrderView),
    invoices: result.invoices.map(toInvoiceView),
    transactions: result.transactions.map(toTransactionView),
    decisions: result.decisions.map(toDecisionView),
})
