import type { InboxChip, InboxStage } from "./inbox-leads.contracts"

/** The order statuses that mean the customer ordered. */
const ORDERED_STATUSES: ReadonlySet<string> = new Set(["confirmed", "invoiced"])

/** The lead stages the sales module closes a customer with. */
const CLOSED_LEAD_STAGES: ReadonlySet<string> = new Set(["won", "lost"])

/** The lead stages that mean the agent is already talking with the customer. */
const TALKING_LEAD_STAGES: ReadonlySet<string> = new Set(["qualified", "proposal"])

/** The facts a stage is derived from. */
export interface StageFacts {
    /** The stage the sales module wrote on the lead, or null when the customer is no lead yet. */
    readonly leadStage: string | null
    /** The statuses of the customer's orders, with whether each has shipped. */
    readonly orders: ReadonlyArray<{ readonly status: string; readonly isShipped: boolean }>
    /** A bank credit matched this customer. */
    readonly hasMatchedPayment: boolean
}

/** Whether the customer has an order that is more than a draft or a cancelled one. */
export const hasOrder = (facts: StageFacts): boolean =>
    facts.orders.some((order) => ORDERED_STATUSES.has(order.status) || order.status === "paid")

/** Whether the customer paid: an order is paid, or a credit matched. */
export const hasPaid = (facts: StageFacts): boolean =>
    facts.hasMatchedPayment || facts.orders.some((order) => order.status === "paid")

/**
 * The stage of a customer, from the facts and not from a column: an order that is more than a draft is `ordered`, a payment that matched is
 * `paid`, a paid order that shipped (or a lead the sales module closed) is `done`; before any order the lead's own stage tells new from
 * consulting.
 */
export const stageOf = (facts: StageFacts): InboxStage => {
    const shipped = facts.orders.some((order) => order.status === "paid" && order.isShipped)
    if (shipped) return "done"
    if (hasPaid(facts)) return facts.leadStage === "won" ? "done" : "paid"
    if (hasOrder(facts)) return "ordered"
    if (facts.leadStage !== null && CLOSED_LEAD_STAGES.has(facts.leadStage)) return "done"
    if (facts.leadStage !== null && TALKING_LEAD_STAGES.has(facts.leadStage)) return "consulting"
    return "new"
}

/** What marks a row beyond its stage. */
export interface ChipFacts {
    /** The stage the customer stands in. */
    readonly stage: InboxStage
    /** Something waits for the owner. */
    readonly needsOwner: boolean
    /** An order was confirmed and no payment matched it yet. */
    readonly awaitingPayment: boolean
    /** The row is a bank credit no order has claimed. */
    readonly isUnmatched: boolean
}

/** The marks of a row, most important first: what needs the owner, then the stage word. */
export const chipsOf = (facts: ChipFacts): ReadonlyArray<InboxChip> => {
    if (facts.isUnmatched) return ["unmatched"]
    const stageChip: InboxChip = facts.awaitingPayment || facts.stage === "ordered" ? "awaiting_payment" : facts.stage
    return facts.needsOwner ? ["needs_you", stageChip] : [stageChip]
}

/** Whether an order waits for its payment. */
export const isAwaitingPayment = (orders: StageFacts["orders"]): boolean =>
    orders.some((order) => ORDERED_STATUSES.has(order.status))
