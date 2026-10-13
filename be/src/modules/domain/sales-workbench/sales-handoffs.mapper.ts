import type { InvoiceViewRow as Invoice } from "@modules/domain/invoices"
import type { OrdersWorkbenchRow as Order } from "@modules/domain/orders"
import type { LeadView as LeadRecord } from "@modules/domain/leads"
import type { WorkItemView } from "./work-item-view.contracts"
import type { HandoffRow } from "./sales-workbench.contracts"

/** The rows the hand-off surface is derived from. */
export interface HandoffRows {
    /** The invoices that may bill a Sales order. */
    readonly invoices: ReadonlyArray<Invoice>
    /** The flow items that may perform Accounting handoffs. */
    readonly items: ReadonlyArray<WorkItemView>
    /** The customer records displayed by the workbench. */
    readonly leads: ReadonlyArray<LeadRecord>
}

/** The lookups the hand-off surface shares with the rest of the workbench. */
export interface HandoffLook {
    /** The orders that are not cancelled. */
    readonly orders: ReadonlyArray<Order>
    /** Customers addressed by their lead id. */
    readonly leadById: ReadonlyMap<string, LeadRecord>
    /** The latest proposed quote amount for each customer. */
    readonly quoteByLead: ReadonlyMap<string, number>
    /** The latest outcome reason and instant for each closed deal. */
    readonly closedByLead: ReadonlyMap<string, { reason: string | null; at: string }>
}

/** Orders and won deals with where their invoice stands. */
export const handoffsOf = (rows: HandoffRows, look: HandoffLook): ReadonlyArray<HandoffRow> => {
    const invoiceByOrder = new Map<string, Invoice>()
    for (const invoice of rows.invoices)
        if (invoice.order_id && invoice.status !== "void") invoiceByOrder.set(invoice.order_id, invoice)
    const invoiceWork = new Map<string, WorkItemView>()
    for (const item of rows.items)
        if (item.action === "issue_invoice" && item.subject_id && !invoiceWork.has(item.subject_id))
            invoiceWork.set(item.subject_id, item)
    const slim = (item: WorkItemView | undefined): HandoffRow["work"] =>
        item ? { id: item.id, status: item.status, reason: item.reason, error: item.error } : null
    const nameOf = (leadId: string | null): string => (leadId ? (look.leadById.get(leadId)?.contact_name ?? "—") : "—")
    const out: Array<HandoffRow> = look.orders.map((order) => {
        const invoice = invoiceByOrder.get(order.id)
        const work = invoiceWork.get(order.id)
        const noActive = !work || work.status === "rejected"
        return {
            key: `order:${order.id}`,
            orderId: order.id,
            leadId: order.lead_id,
            customer: nameOf(order.lead_id),
            orderNo: order.order_no,
            items: order.items,
            amountVnd: order.amount_vnd,
            orderStatus: order.status,
            confirmedAt: order.confirmed_at,
            invoice: invoice
                ? {
                      no: invoice.invoice_no,
                      status: invoice.status,
                      amountVnd: invoice.amount_vnd,
                      issuedAt: invoice.issued_at,
                      paidAt: invoice.paid_at,
                  }
                : null,
            work: slim(work),
            canHandoff: order.status === "confirmed" && !invoice && noActive,
            shippedAt: order.shipped_at ?? null,
            carrier: order.carrier ?? null,
            trackingCode: order.tracking_code ?? null,
            canShip: ["confirmed", "invoiced", "paid"].includes(order.status) && !order.shipped_at,
        }
    })
    const leadsWithOrder = new Set(look.orders.map((order) => order.lead_id).filter((id): id is string => !!id))
    for (const lead of rows.leads) {
        if (lead.stage !== "won" || leadsWithOrder.has(lead.id)) continue
        out.push({
            key: `lead:${lead.id}`,
            orderId: null,
            leadId: lead.id,
            customer: lead.contact_name,
            orderNo: null,
            items: lead.need,
            amountVnd: look.quoteByLead.get(lead.id) ?? null,
            orderStatus: "won_without_order",
            confirmedAt: look.closedByLead.get(lead.id)?.at ?? null,
            invoice: null,
            work: slim(invoiceWork.get(lead.id)),
            canHandoff: false,
            shippedAt: null,
            carrier: null,
            trackingCode: null,
            canShip: false,
        })
    }
    return out.sort((a, b) => (b.confirmedAt ?? "").localeCompare(a.confirmedAt ?? ""))
}
