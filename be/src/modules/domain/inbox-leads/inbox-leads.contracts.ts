/** The tabs of the lead list; each narrows the same set of customers. */
export type InboxTab = "all" | "new" | "needs_you" | "ordered" | "paid"

/** How the lead list is ordered. */
export type InboxSort = "recent" | "oldest" | "name" | "amount"

/** Where a customer stands, derived from the facts: an order exists, a payment matched. */
export type InboxStage = "new" | "consulting" | "ordered" | "paid" | "done"

/** The marks a lead row wears; the front end gives each its words. */
export type InboxChip = "new" | "consulting" | "needs_you" | "awaiting_payment" | "paid" | "unmatched" | "done"

/** An agent id, or null when there is none. */
export type OptionalAgentId = string | null

/** What the lead list is asked for; the tab, the order and the search are the words the transport received, and the service reads them. */
export interface InboxLeadsQuery {
    /** The tab: `all`, `new`, `needs_you`, `ordered` or `paid`; any other word reads as `all`. */
    readonly tab: string
    /** One channel key, or null for every channel. */
    readonly channel: string | null
    /** One agent id, or null for every agent. */
    readonly agentId: OptionalAgentId
    /** The order: `recent`, `oldest`, `name` or `amount`; any other word reads as `recent`. */
    readonly sort: string
    /** Words to search the name, phone, need and last words; blank words search nothing. */
    readonly search: string | null
    /** The most leads returned, 1..100. */
    readonly limit: number
}

/** One customer of the inbox: every input of one person or business grouped into one row. */
export interface InboxLeadRow {
    /** The lead id; `key:<customer key>` or `event:<event id>` for a customer that is no lead yet. */
    readonly id: string
    /** The name; empty when nobody gave one. */
    readonly name: string
    /** The channel key of the customer: zalo, telegram, facebook, instagram, website or bank. */
    readonly channel: string
    /** How the latest talk arrived on its channel: `form`, `chat` or `message`; null when unknown. */
    readonly via: string | null
    /** Where the customer stands. */
    readonly stage: InboxStage
    /** The marks of the row, most important first. */
    readonly chips: ReadonlyArray<InboxChip>
    /** What the customer wants, in two lines at most. */
    readonly summary: string
    /** When the latest input arrived, ISO 8601. */
    readonly lastAt: string
    /** When the first input arrived, ISO 8601. */
    readonly firstAt: string
    /** Something waits for the owner: a draft order to approve, a decision, a customer the agent handed over. */
    readonly needsOwner: boolean
    /** The agent that owns the customer, or null. */
    readonly agentId: OptionalAgentId
    /** The name of that agent, or null. */
    readonly agentName: string | null
    /** The picture of that agent, or null. */
    readonly agentAvatarUrl: string | null
    /** The value in VND: the order, else the quote, else null. */
    readonly amountVnd: number | null
    /** How many inputs were grouped into the row. */
    readonly eventCount: number
    /** The row is a bank credit no order has claimed. */
    readonly isUnmatched: boolean
}

/** How many customers each tab holds, under the same channel, agent and search. */
export interface InboxCounts {
    /** Every customer. */
    readonly all: number
    /** New customers. */
    readonly new: number
    /** Customers something waits on the owner for. */
    readonly needsYou: number
    /** Customers with an order. */
    readonly ordered: number
    /** Customers whose money came in. */
    readonly paid: number
}

/** The figures of the strip above the list. */
export interface InboxFigures {
    /** Customers with an input in the last seven days. */
    readonly visitors7d: number
    /** Customers whose first input came in the last day. */
    readonly newToday: number
    /** Customers something waits on the owner for. */
    readonly needsYou: number
    /** The share of the work of the week that the agents did alone, 0..100; null when there was no work. */
    readonly autoReplyPct: number | null
    /** The mean seconds from an input to the agent finishing it over the week; null when none finished. */
    readonly avgResponseSeconds: number | null
}

/** One agent the list can be filtered by or a customer handed to. */
export interface InboxAgentOption {
    /** The agent id. */
    readonly id: string
    /** The agent name. */
    readonly name: string
}

/** The answer of the lead list: the rows, the counts per tab, the figures and the agents. */
export interface InboxLeadsPage {
    /** The customers of the tab, in the asked order. */
    readonly leads: ReadonlyArray<InboxLeadRow>
    /** How many customers each tab holds. */
    readonly counts: InboxCounts
    /** The figures of the strip. */
    readonly figures: InboxFigures
    /** The active agents of the workspace. */
    readonly agents: ReadonlyArray<InboxAgentOption>
}

/** What waits for the owner on one customer. */
export interface InboxApproval {
    /** The draft order to approve; null when what waits is no order. */
    readonly orderId: string | null
    /** The number of the draft order, or null. */
    readonly orderNo: string | null
    /** The value in VND, or null. */
    readonly amountVnd: number | null
    /** What the order holds, in words; null when empty. */
    readonly itemsText: string | null
    /** The agent that asked, or null. */
    readonly agentName: string | null
}

/** What the customer needs: the summary and the facts the agent extracted. */
export interface InboxNeeds {
    /** The summary of what they want, or null. */
    readonly summary: string | null
    /** What they want to buy, or null. */
    readonly items: string | null
    /** The value in VND, or null. */
    readonly valueVnd: number | null
    /** When and where it should arrive, or null. */
    readonly delivery: string | null
    /** A note about the order, or null. */
    readonly note: string | null
}

/** One entry of the journey across channels. */
export interface InboxTimelineEntry {
    /** The entry id, prefixed by where it came from. */
    readonly id: string
    /** `message`, `agent`, `order`, `payment` or `decision`. */
    readonly kind: string
    /** When, ISO 8601. */
    readonly at: string
    /** The channel key the entry belongs to, or null. */
    readonly channel: string | null
    /** The text; for an agent entry, the action key; for an order, its number. */
    readonly text: string
    /** The status of the thing the entry is about (a work status, an order status, a decision outcome), or null. */
    readonly status: string | null
    /** The value in VND, or null. */
    readonly amountVnd: number | null
}

/** One order of the customer. */
export interface InboxOrder {
    /** The order id. */
    readonly id: string
    /** The order number. */
    readonly orderNo: string
    /** The order status. */
    readonly status: string
    /** The value in VND, or null. */
    readonly amountVnd: number | null
    /** What it holds, in words, or null. */
    readonly itemsText: string | null
    /** When it was made, ISO 8601. */
    readonly createdAt: string
}

/** Where the customer came from. */
export interface InboxSource {
    /** The channel key. */
    readonly channel: string
    /** How the customer arrived on it: `form`, `chat` or `message`; null when unknown. */
    readonly via: string | null
    /** The page of the site the form sat on, or null. */
    readonly landing: string | null
    /** The campaign the visit came from, or null. */
    readonly campaign: string | null
    /** The device kind, or null. */
    readonly device: string | null
}

/** One customer opened: the head, what waits, what they need, the journey and the aside. */
export interface InboxLeadDetail {
    /** The row of the customer. */
    readonly lead: InboxLeadRow
    /** The phone, or null. */
    readonly phone: string | null
    /** The email, or null. */
    readonly email: string | null
    /** The customer talks to the shop on Zalo too. */
    readonly zaloLinked: boolean
    /** What waits for the owner, or null. */
    readonly approval: InboxApproval | null
    /** What the customer needs. */
    readonly needs: InboxNeeds
    /** The journey, oldest first. */
    readonly timeline: ReadonlyArray<InboxTimelineEntry>
    /** Where the customer came from. */
    readonly source: InboxSource
    /** The orders that are more than a draft. */
    readonly orders: ReadonlyArray<InboxOrder>
    /** What was paid, in VND. */
    readonly paidVnd: number
    /** How many orders were paid. */
    readonly paidCount: number
}
