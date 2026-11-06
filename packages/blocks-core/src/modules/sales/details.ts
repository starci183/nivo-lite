import { waitsForOwner } from "../../rules/sales/order-confirm"
import { canConfirm } from "../../rules/sales/order-status"
import type { SalesSettings } from "../../rules/sales/settings"
import type { OrderSummary } from "../../rules/sales/lead-orders"
import type { LeadDetail, LeadRow, OrderApproval, OrderDetail, OrderRow } from "./sales.types"

/** The lead with what its orders add up to, flat for a detail block. */
export const leadDetailOf = (lead: LeadRow, orders: OrderSummary): LeadDetail => ({
    id: lead.id,
    contactName: lead.contactName,
    company: lead.company ?? "",
    channel: lead.channel,
    need: lead.need ?? "",
    stage: lead.stage,
    phone: lead.phone,
    email: lead.email,
    contextSummary: lead.contextSummary,
    closedReason: lead.closedReason,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    orderCount: orders.count,
    confirmedVnd: orders.confirmedVnd,
    latestOrderNo: orders.latest?.orderNo ?? null,
    latestOrderStatus: orders.latest?.status ?? null,
    latestOrderAmountVnd: orders.latest?.amountVnd ?? null,
})

/** Who confirms the order: the owner while it waits for them, the shop for a small draft, nobody once it is no draft. */
const approvalOf = (order: OrderRow, settings: SalesSettings): OrderApproval => {
    if (order.status !== "draft") return "done"
    return waitsForOwner(order, settings) ? "owner" : "shop"
}

/** The order with its customer's name and who confirms it, flat for a detail block. */
export const orderDetailOf = (
    order: OrderRow,
    customer: string | null,
    settings: SalesSettings,
    canCancel: boolean,
): OrderDetail => ({
    id: order.id,
    orderNo: order.orderNo,
    leadId: order.leadId,
    customer,
    items: order.itemsText,
    note: order.note,
    amountVnd: order.amountVnd,
    status: order.status,
    approval: approvalOf(order, settings),
    canConfirm: canConfirm(order.status),
    canCancel,
    thresholdVnd: settings.approvalThresholdVnd,
    confirmedBy: order.confirmedBy,
    confirmedAt: order.confirmedAt,
    createdAt: order.createdAt,
    shippedAt: order.shippedAt,
    carrier: order.carrier,
    trackingCode: order.trackingCode,
})
