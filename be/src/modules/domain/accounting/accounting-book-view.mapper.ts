import type { AccountingBook } from "./accounting-book.contracts"
import type { AccountingBookLeadView, AccountingBookView } from "./accounting-book-view.contracts"

/** Customer labels normalized for evidence inspection. */
interface OptionalLeadNames {
    /** The customer contact name. */
    readonly contact_name: string | null
    /** The company name. */
    readonly company: string | null
}
/** The optional customer relation used by invoices and orders. */
type OptionalLead = OptionalLeadNames | null

const toBookLeadView = (lead: OptionalLead): AccountingBookLeadView | null =>
    lead === null ? null : { contactName: lead.contact_name, company: lead.company }

/** Maps one invoice record to its book view. */
const toInvoiceView = (row: AccountingBook["invoices"][number]) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    orderId: row.order_id,
    leadId: row.lead_id,
    invoiceNo: row.invoice_no,
    amountVnd: row.amount_vnd,
    status: row.status,
    issuedBy: row.issued_by,
    paidAt: row.paid_at,
    issuedAt: row.issued_at,
    dueAt: row.due_at,
    createdAt: row.created_at,
    order:
        row.order === null
            ? null
            : {
                  orderNo: row.order.order_no,
                  items: row.order.items,
                  amountVnd: row.order.amount_vnd,
                  status: row.order.status,
              },
    lead: toBookLeadView(row.lead),
})

/** Maps one transaction record to its book view. */
const toTransactionView = (row: AccountingBook["transactions"][number]) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    inboundEventId: row.inbound_event_id,
    amountVnd: row.amount_vnd,
    reference: row.reference,
    payer: row.payer,
    invoiceId: row.invoice_id,
    status: row.status,
    channel: row.channel,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    inbound:
        row.inbound === null
            ? null
            : {
                  channel: row.inbound.channel,
                  eventId: row.inbound.event_id,
                  body: row.inbound.body,
                  senderName: row.inbound.sender_name,
              },
})

/** Maps one order record to its book view. */
const toOrderView = (row: AccountingBook["orders"][number]) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    leadId: row.lead_id,
    inboundEventId: row.inbound_event_id,
    orderNo: row.order_no,
    items: row.items,
    amountVnd: row.amount_vnd,
    status: row.status,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    shippedAt: row.shipped_at,
    carrier: row.carrier,
    trackingCode: row.tracking_code,
    lead: toBookLeadView(row.lead),
})

/** Maps one work item record to its book view. */
const toWorkView = (row: AccountingBook["works"][number]) => ({
    id: row.id,
    action: row.action,
    status: row.status,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    createdAt: row.created_at,
})

/** Maps one decision record to its book view. */
const toDecisionView = (row: AccountingBook["decisions"][number]) => ({
    id: row.id,
    workItemId: row.work_item_id,
    action: row.action,
    decidedBy: row.decided_by,
    deciderKind: row.decider_kind,
    outcome: row.outcome,
    note: row.note,
    createdAt: row.created_at,
})

/** Maps one adjustment record to its book view. */
const toAdjustmentView = (row: AccountingBook["adjustments"][number]) => ({
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    note: row.note,
    correctedAmount: row.corrected_amount_vnd,
    createdBy: row.created_by,
    createdAt: row.created_at,
})

/** Maps owned persistence records to the GraphQL accounting book. */
export const toAccountingBookView = (book: AccountingBook): AccountingBookView => ({
    invoices: book.invoices.map(toInvoiceView),
    transactions: book.transactions.map(toTransactionView),
    orders: book.orders.map(toOrderView),
    works: book.works.map(toWorkView),
    decisions: book.decisions.map(toDecisionView),
    adjustments: book.adjustments.map(toAdjustmentView),
    adjustmentsReady: book.adjustmentsReady,
})
