import type { Database } from "../../../../../../../supabase/types/database.types"
import type { Invoice, Order, Origin, WorkItemView } from "@/lib/flow-types"
import type { HandoffRow, LeadRecord } from "@/modules/types"

type Tables = Database["public"]["Tables"]

/** One generated row of public.orders. */
export type OrdersRow = Tables["orders"]["Row"]
/** One generated row of public.invoices. */
export type InvoicesRow = Tables["invoices"]["Row"]

/** The rows the hand-off surface is derived from. */
export interface HandoffRows {
    readonly invoices: ReadonlyArray<Invoice>
    readonly items: ReadonlyArray<WorkItemView>
    readonly leads: ReadonlyArray<LeadRecord>
}

/** The lookups the hand-off surface shares with the rest of the workbench. */
export interface HandoffLook {
    /** The orders that are not cancelled. */
    readonly orders: ReadonlyArray<Order>
    readonly leadById: ReadonlyMap<string, LeadRecord>
    readonly quoteByLead: ReadonlyMap<string, number>
    readonly closedByLead: ReadonlyMap<string, { reason: string | null; at: string }>
}

const ORDER_STATUSES: ReadonlyArray<Order["status"]> = ["draft", "confirmed", "invoiced", "paid", "cancelled"]
const INVOICE_STATUSES: ReadonlyArray<Invoice["status"]> = ["draft", "issued", "paid", "void"]

const originOf = (value: string | null): Origin => (value === "simulated" ? "simulated" : "live")

/** One order row as the workbench reads it. */
export const toOrder = (row: OrdersRow): Order => ({
    id: row.id,
    workspace_id: row.workspace_id,
    lead_id: row.lead_id,
    order_no: row.order_no,
    items: row.items,
    amount_vnd: row.amount_vnd,
    status: ORDER_STATUSES.find((status) => status === row.status) ?? "draft",
    origin: originOf(row.origin),
    confirmed_by: row.confirmed_by,
    confirmed_at: row.confirmed_at,
    created_at: row.created_at,
    shipped_at: row.shipped_at,
    carrier: row.carrier,
    tracking_code: row.tracking_code,
})

/** One invoice row as the workbench reads it. */
export const toInvoice = (row: InvoicesRow): Invoice => ({
    id: row.id,
    workspace_id: row.workspace_id,
    order_id: row.order_id,
    lead_id: row.lead_id,
    invoice_no: row.invoice_no,
    amount_vnd: row.amount_vnd,
    due_at: row.due_at,
    status: INVOICE_STATUSES.find((status) => status === row.status) ?? "draft",
    origin: originOf(row.origin),
    issued_by: row.issued_by,
    issued_at: row.issued_at,
    paid_at: row.paid_at,
    created_at: row.created_at,
})

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
