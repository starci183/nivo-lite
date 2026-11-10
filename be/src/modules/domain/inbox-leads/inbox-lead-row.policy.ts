import type { InboxLeadRow } from "./inbox-leads.contracts"
import { chipsOf, hasPaid, isAwaitingPayment, stageOf } from "./inbox-lead-stage.policy"

/** The longest summary a row carries. */
const SUMMARY_LIMIT = 160

/** One order of a customer as the row policy reads it. */
export interface OrderFacts {
    /** The id. */
    readonly id: string
    /** The order number. */
    readonly orderNo: string
    /** Where it stands. */
    readonly status: string
    /** The value in VND, or null. */
    readonly amountVnd: number | null
    /** It was handed to a carrier. */
    readonly isShipped: boolean
    /** What it holds, in words, or null. */
    readonly itemsText: string | null
    /** A note on it, or null. */
    readonly note: string | null
    /** When it was made, ISO 8601. */
    readonly createdAt: string
    /** When it last changed, ISO 8601: for a paid order, about when the money matched. */
    readonly updatedAt: string
}

/** The conversation that holds the customer with an agent. */
export interface ConversationFacts {
    /** The agent that holds it, or null. */
    readonly agentId: string | null
    /** `ai`, `needs` or `handled`. */
    readonly status: string
    /** The last words of the conversation. */
    readonly lastText: string
    /** The channel key. */
    readonly channel: string
}

/** Everything known about one customer before it becomes a row. */
export interface LeadFacts {
    /** The id. */
    readonly id: string
    /** The name; empty when nobody gave one. */
    readonly name: string
    /** The channel key. */
    readonly channel: string
    /** How the latest talk arrived: form, chat or message; null when unknown. */
    readonly via: string | null
    /** The stage the sales module wrote, or null when the customer is no lead yet. */
    readonly leadStage: string | null
    /** What the customer asked for, or null. */
    readonly need: string | null
    /** The summary the agent wrote, or null. */
    readonly contextSummary: string | null
    /** The value quoted in VND, or null. */
    readonly quoteVnd: number | null
    /** What the sales module wrote as the next step (a delivery time and place, say), or null. */
    readonly nextStep: string | null
    /** The agent the owner handed the customer to (a uuid text), or null. */
    readonly ownerAgentId: string | null
    /** The orders of the customer, newest first. */
    readonly orders: ReadonlyArray<OrderFacts>
    /** A bank credit matched this customer. */
    readonly hasMatchedPayment: boolean
    /** The newest conversation of the customer, or null. */
    readonly conversation: ConversationFacts | null
    /** How many work items of the customer wait for a decision. */
    readonly waitingWork: number
    /** When the first input arrived, ISO 8601. */
    readonly firstAt: string
    /** When the latest input arrived, ISO 8601. */
    readonly lastAt: string
    /** How many inputs were grouped. */
    readonly eventCount: number
    /** The words of the latest talk input. */
    readonly lastBody: string
    /** The row is a bank credit nobody claimed. */
    readonly isUnmatched: boolean
}

/** The identity of an agent as a row shows it. */
export interface AgentMark {
    /** The name; empty when nobody gave one. */
    readonly name: string
    /** The picture of the agent, or null. */
    readonly avatarUrl: string | null
}

/** A text shortened to the summary limit, on one line. */
export const clipped = (text: string): string => {
    const flat = text.replace(/\s+/g, " ").trim()
    return flat.length <= SUMMARY_LIMIT ? flat : `${flat.slice(0, SUMMARY_LIMIT - 1)}…`
}

/** The first of the given texts that has words, or an empty text. */
const firstText = (...texts: ReadonlyArray<string | null>): string => {
    const found = texts.find((text) => text !== null && text.trim() !== "")
    return found === undefined || found === null ? "" : clipped(found)
}

/** Whether the customer has a draft order the owner must decide on. */
export const hasDraftOrder = (facts: Pick<LeadFacts, "orders">): boolean =>
    facts.orders.some((order) => order.status === "draft")

/** The value of the customer: the newest live order, else the quote. */
const valueOf = (facts: LeadFacts): number | null => {
    const live = facts.orders.find((order) => order.status !== "cancelled" && order.amountVnd !== null)
    return live?.amountVnd ?? facts.quoteVnd
}

/** Turns the facts of a customer into the row the list draws. */
export const rowOf = (facts: LeadFacts, agents: ReadonlyMap<string, AgentMark>): InboxLeadRow => {
    const stageFacts = {
        leadStage: facts.leadStage,
        orders: facts.orders,
        hasMatchedPayment: facts.hasMatchedPayment,
    }
    const needsOwner = hasDraftOrder(facts) || facts.waitingWork > 0 || facts.conversation?.status === "needs"
    const stage = facts.isUnmatched ? "paid" : stageOf(stageFacts)
    const agentId = facts.ownerAgentId ?? facts.conversation?.agentId ?? null
    const mark = agentId === null ? undefined : agents.get(agentId)
    return {
        id: facts.id,
        name: facts.name,
        channel: facts.channel,
        via: facts.via,
        stage,
        chips: chipsOf({
            stage,
            needsOwner,
            awaitingPayment: !hasPaid(stageFacts) && isAwaitingPayment(facts.orders),
            isUnmatched: facts.isUnmatched,
        }),
        summary: firstText(facts.contextSummary, facts.need, facts.conversation?.lastText ?? null, facts.lastBody),
        lastAt: facts.lastAt,
        firstAt: facts.firstAt,
        needsOwner,
        agentId: mark === undefined ? null : agentId,
        agentName: mark?.name ?? null,
        agentAvatarUrl: mark?.avatarUrl ?? null,
        amountVnd: valueOf(facts),
        eventCount: facts.eventCount,
        isUnmatched: facts.isUnmatched,
    }
}
