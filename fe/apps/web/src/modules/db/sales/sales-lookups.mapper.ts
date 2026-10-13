import type { Order, WorkItemView } from "@/lib/flow-types"
import type { LeadRecord, ResponsibilityRecord } from "@/modules/types"
import type { SalesRows } from "./sales.rows"

/** The customer, order and flow lookups shared by Sales workbench views. */
export interface SalesLookups {
    readonly leadById: ReadonlyMap<string, LeadRecord>
    readonly openStepByLead: ReadonlyMap<string, ResponsibilityRecord>
    readonly orders: ReadonlyArray<Order>
    readonly orderByLead: ReadonlyMap<string, Order>
    readonly quoteByLead: ReadonlyMap<string, number>
    readonly waitingByLead: ReadonlyMap<string, WorkItemView>
    readonly closedByLead: ReadonlyMap<string, { reason: string | null; at: string }>
}

/** Indexes already-loaded Sales records for the workbench's view mapping. */
export const lookupsOf = (rows: SalesRows): SalesLookups => {
    const openStepByLead = new Map<string, ResponsibilityRecord>()
    for (const step of rows.steps) if (!openStepByLead.has(step.lead_id)) openStepByLead.set(step.lead_id, step)
    const orders = rows.orders.filter((order) => order.status !== "cancelled")
    const orderByLead = new Map<string, Order>()
    for (const order of orders)
        if (order.lead_id && !orderByLead.has(order.lead_id)) orderByLead.set(order.lead_id, order)
    const quoteByLead = new Map<string, number>()
    for (const item of rows.items) {
        const amount = item.proposal.amount_vnd
        if (
            item.action === "send_quote" &&
            item.lead_id &&
            item.status !== "rejected" &&
            typeof amount === "number" &&
            !quoteByLead.has(item.lead_id)
        ) {
            quoteByLead.set(item.lead_id, amount)
        }
    }
    const waitingByLead = new Map<string, WorkItemView>()
    for (const item of rows.items) {
        if (item.lead_id && item.status === "waiting_decision" && !waitingByLead.has(item.lead_id))
            waitingByLead.set(item.lead_id, item)
    }
    const closedByLead = new Map<string, { reason: string | null; at: string }>()
    for (const event of rows.outcomes) {
        if (event.lead_id && !closedByLead.has(event.lead_id))
            closedByLead.set(event.lead_id, { reason: event.evidence, at: event.created_at })
    }
    return {
        leadById: new Map(rows.leads.map((lead) => [lead.id, lead])),
        openStepByLead,
        orders,
        orderByLead,
        quoteByLead,
        waitingByLead,
        closedByLead,
    }
}
