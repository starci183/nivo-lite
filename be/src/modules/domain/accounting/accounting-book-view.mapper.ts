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

/** Maps owned persistence records to the GraphQL accounting book. */
export const toAccountingBookView = (book: AccountingBook): AccountingBookView => ({
    invoices: book.invoices.map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        orderId: row.order_id,
        leadId: row.lead_id,
        invoiceNo: row.invoice_no,
        amountVnd: row.amount_vnd,
        status: row.status,
        origin: row.origin,
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
    })),
    transactions: book.transactions.map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        inboundEventId: row.inbound_event_id,
        amountVnd: row.amount_vnd,
        reference: row.reference,
        payer: row.payer,
        invoiceId: row.invoice_id,
        status: row.status,
        origin: row.origin,
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
    })),
    orders: book.orders.map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        leadId: row.lead_id,
        inboundEventId: row.inbound_event_id,
        orderNo: row.order_no,
        items: row.items,
        amountVnd: row.amount_vnd,
        status: row.status,
        origin: row.origin,
        confirmedBy: row.confirmed_by,
        confirmedAt: row.confirmed_at,
        createdAt: row.created_at,
        shippedAt: row.shipped_at,
        carrier: row.carrier,
        trackingCode: row.tracking_code,
        lead: toBookLeadView(row.lead),
    })),
    works: book.works.map((row) => ({
        id: row.id,
        action: row.action,
        status: row.status,
        subjectType: row.subject_type,
        subjectId: row.subject_id,
        createdAt: row.created_at,
    })),
    decisions: book.decisions.map((row) => ({
        id: row.id,
        workItemId: row.work_item_id,
        action: row.action,
        decidedBy: row.decided_by,
        deciderKind: row.decider_kind,
        outcome: row.outcome,
        note: row.note,
        createdAt: row.created_at,
    })),
    adjustments: book.adjustments.map((row) => ({
        id: row.id,
        targetType: row.target_type,
        targetId: row.target_id,
        note: row.note,
        correctedAmount: row.corrected_amount_vnd,
        createdBy: row.created_by,
        createdAt: row.created_at,
    })),
    adjustmentsReady: book.adjustmentsReady,
})
