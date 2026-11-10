import type { InboxApproval, InboxNeeds, InboxOrder, InboxSource, InboxTimelineEntry } from "./inbox-leads.contracts"
import type { JourneyDecision, JourneyEvent, JourneyWork } from "./inbox-leads-events.service"
import type { LeadFacts, OrderFacts } from "./inbox-lead-row.policy"

/** The most entries a journey shows. */
const JOURNEY_LIMIT = 60

/** The inputs that are talk with the customer rather than money or orders. */
const TALK_KINDS: ReadonlySet<string> = new Set(["lead", "message"])

/** What was paid: the sum and how many orders it covers. */
export interface PaidTotal {
    /** The sum of the paid orders in VND. */
    readonly amountVnd: number
    /** How many orders are paid. */
    readonly count: number
}

/** Everything a journey is made of. */
export interface JourneyParts {
    /** What the customer sent and what arrived for them. */
    readonly events: ReadonlyArray<JourneyEvent>
    /** What the agents did. */
    readonly work: ReadonlyArray<JourneyWork>
    /** What the owner decided. */
    readonly decisions: ReadonlyArray<JourneyDecision>
    /** The orders of the customer. */
    readonly orders: ReadonlyArray<OrderFacts>
}

/** The newest order that waits for the owner, as what asks for the decision. */
export const approvalOf = (facts: LeadFacts, agentName: string | null): InboxApproval | null => {
    const draft = facts.orders.find((order) => order.status === "draft")
    if (draft !== undefined) {
        return {
            orderId: draft.id,
            orderNo: draft.orderNo === "" ? null : draft.orderNo,
            amountVnd: draft.amountVnd,
            itemsText: draft.itemsText,
            agentName,
        }
    }
    if (facts.waitingWork === 0) return null
    return { orderId: null, orderNo: null, amountVnd: null, itemsText: null, agentName }
}

/** What the customer needs: the summary and the facts that the lead and the newest live order hold. */
export const needsOf = (facts: LeadFacts, note: string | null): InboxNeeds => {
    const live = facts.orders.find((order) => order.status !== "cancelled")
    return {
        summary: facts.contextSummary ?? facts.need,
        items: live?.itemsText ?? facts.need,
        valueVnd: live?.amountVnd ?? facts.quoteVnd,
        delivery: facts.nextStep,
        note: live?.note ?? note,
    }
}

/** A source value that says something, else null. */
const saidOf = (value: string | undefined): string | null => (value === undefined || value === "" ? null : value)

/** Where the customer came from: the first input that says, else what the channel alone tells. */
export const sourceOf = (facts: LeadFacts, events: ReadonlyArray<JourneyEvent>): InboxSource => {
    const first = events.findLast((event) => Object.keys(event.source).length > 0)
    return {
        channel: facts.channel,
        via: facts.via,
        landing: saidOf(first?.source["page"]),
        campaign: saidOf(first?.source["campaign"]),
        device: saidOf(first?.source["device"]),
    }
}

/** How the newest talk input arrived on a website: a posted form is a lead input, a typed line is a message. */
export const viaOf = (channel: string, talkKind: string): string | null => {
    if (channel !== "website") return null
    if (talkKind === "lead") return "form"
    return talkKind === "message" ? "chat" : null
}

/** The orders of a customer as the aside lists them: the ones that are more than a draft. */
export const ordersOf = (orders: ReadonlyArray<OrderFacts>): ReadonlyArray<InboxOrder> =>
    orders
        .filter((order) => order.status !== "draft")
        .map((order) => ({
            id: order.id,
            orderNo: order.orderNo,
            status: order.status,
            amountVnd: order.amountVnd,
            itemsText: order.itemsText,
            createdAt: order.createdAt,
        }))

/** What the customer paid: the orders that are paid. */
export const paidOf = (orders: ReadonlyArray<OrderFacts>): PaidTotal => {
    const paid = orders.filter((order) => order.status === "paid")
    return { amountVnd: paid.reduce((sum, order) => sum + (order.amountVnd ?? 0), 0), count: paid.length }
}

/** The kind of journey entry an input becomes: talk, money or an order. */
const kindOfEvent = (kind: string): string => {
    if (TALK_KINDS.has(kind)) return "message"
    return kind === "payment" ? "payment" : "order"
}

/** The kind of journey entry an order becomes: a payment once it is paid. */
const kindOfOrder = (order: OrderFacts): string => (order.status === "paid" ? "payment" : "order")

/**
 * The journey across channels, oldest first: what the customer sent, what the agents did, what the owner decided, the orders and the
 * payments. Only the newest entries are kept when there are more than the limit.
 */
export const timelineOf = (parts: JourneyParts): ReadonlyArray<InboxTimelineEntry> => {
    const hasReceipt = parts.events.some((event) => event.kind === "payment")
    const entries: Array<InboxTimelineEntry> = [
        ...parts.events.map((event) => ({
            id: `ev:${event.id}`,
            kind: kindOfEvent(event.kind),
            at: event.created_at,
            channel: event.channel,
            text: event.body,
            status: null,
            amountVnd: event.amount_vnd,
        })),
        ...parts.work.map((work) => ({
            id: `wk:${work.id}`,
            kind: "agent",
            at: work.at,
            channel: null,
            text: work.action,
            status: work.status,
            amountVnd: null,
        })),
        ...parts.decisions.map((decision) => ({
            id: `dc:${decision.id}`,
            kind: "decision",
            at: decision.at,
            channel: null,
            text: decision.action,
            status: decision.outcome,
            amountVnd: null,
        })),
        ...parts.orders
            .filter((order) => order.status !== "draft" && order.status !== "cancelled")
            .filter((order) => !(order.status === "paid" && hasReceipt))
            .map((order) => ({
                id: `od:${order.id}`,
                kind: kindOfOrder(order),
                at: order.status === "paid" ? order.updatedAt : order.createdAt,
                channel: null,
                text: order.orderNo,
                status: order.status,
                amountVnd: order.amountVnd,
            })),
    ]
    return entries.toSorted((left, right) => left.at.localeCompare(right.at)).slice(-JOURNEY_LIMIT)
}
