import {
    DealWonEvent,
    DecisionMadeEvent,
    LeadCapturedEvent,
    OrderConfirmedEvent,
    OrderShippedEvent,
    PaymentReconciledEvent,
} from "@modules/events/api"
import type { BaseEvent, EventDelivery } from "@modules/platform/event-bus"

/** A delivery of an event to one consumer, as the bus hands it to a reactor. */
export const deliveryOf = <Event extends BaseEvent>(consumer: string, event: Event): EventDelivery<Event> => ({
    correlationId: "corr-1",
    eventId: event.eventId,
    consumer,
    dedupeKey: event.payload.dedupeKey,
    event,
    attempt: 1,
})

/** A captured lead with every fact the door knows. */
export const lead = LeadCapturedEvent.create({
    workspaceId: "ws-1",
    leadId: "lead-1",
    contactName: "Lan",
    company: "Hue Tea",
    channel: "Zalo",
    need: "tea",
    phone: "84901234567",
})

/** A captured lead with only the facts every lead has. */
export const bareLead = LeadCapturedEvent.create({
    workspaceId: "ws-1",
    leadId: "lead-3",
    contactName: "Cuc",
    company: "Tea Co",
    channel: "Zalo",
    need: "tea",
})

/** A won deal with its order. */
export const deal = DealWonEvent.create({
    workspaceId: "ws-1",
    leadId: "lead-1",
    name: "Lan",
    company: "Hue Tea",
    channel: "Zalo",
    need: "tea",
    orderNo: "SO-1",
    amountVnd: 500000,
})

/** A won deal that carries a source and its evidence. */
export const sourcedDeal = DealWonEvent.create({
    workspaceId: "ws-1",
    leadId: "lead-3",
    name: "Cuong",
    company: "Tea Co",
    channel: "Zalo",
    need: "tea",
    source: "payment",
    evidence: "Paid in full",
})

/** A won deal with only a lead and a name. */
export const bareDeal = DealWonEvent.create({ workspaceId: "ws-1", leadId: "lead-3", name: "Cuc" })

/** A won deal that lacks the optional facts. */
export const unadornedDeal = DealWonEvent.create({
    workspaceId: "ws-1",
    leadId: "lead-2",
    name: "Binh",
    company: "Tea Co",
    channel: "Zalo",
    need: "tea",
})

/** An approved decision about a lead. */
export const decision = DecisionMadeEvent.create({
    workspaceId: "ws-1",
    workItemId: "wi-1",
    action: "send_quote",
    department: "sales",
    outcome: "approved",
    decidedBy: "Lan",
    leadId: "lead-1",
    summary: "Sent",
})

/** An approved decision that is not about a lead. */
export const bareDecision = DecisionMadeEvent.create({
    workspaceId: "ws-1",
    workItemId: "wi-2",
    action: "send_quote",
    department: "sales",
    outcome: "approved",
    decidedBy: "Lan",
    summary: "Sent",
})

/** A reconciled payment with its transaction and order. */
export const payment = PaymentReconciledEvent.create({
    workspaceId: "ws-1",
    invoiceId: "inv-1",
    invoiceNo: "HD1",
    amountVnd: 350000,
    paidAt: "2026-10-12T10:00:00.000Z",
    transactionId: "tx-1",
    workItemId: "wi-1",
    subjectType: "transaction",
    subjectId: "tx-1",
    orderId: "o-1",
    orderNo: "SO-1",
    leadId: "lead-1",
    customer: "Lan",
    channel: "Zalo",
})

/** A reconciled payment that carries only what every invoice has. */
export const barePayment = PaymentReconciledEvent.create({
    workspaceId: "ws-1",
    invoiceId: "inv-1",
    invoiceNo: "HD1",
    workItemId: "wi-1",
    customer: "Lan",
})

/** A confirmed order. */
export const order = OrderConfirmedEvent.create({
    workspaceId: "ws-1",
    orderId: "o-1",
    orderNo: "SO-1",
    leadId: "lead-1",
    customer: "Lan",
    items: "tea",
    amountVnd: 500000,
    channel: "Zalo",
    confirmedBy: "Mai",
})

/** A shipment of the order, recorded by a member. */
export const shipment = OrderShippedEvent.create({
    workspaceId: "ws-1",
    userId: "user-1",
    orderId: "o-1",
    orderNo: "SO-1",
    leadId: "lead-1",
    carrier: "GHN",
    trackingCode: "GHN123",
    shippedAt: "2026-10-12T10:00:00.000Z",
})
