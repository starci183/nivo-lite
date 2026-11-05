import type { DecisionQueueView, DecisionRowView } from "../../views/views.types"
import { moneyLine } from "./money"
import type { WaitingOrder } from "./waiting"

/** The command ids of a sales decision. */
export const SALES_DECISION_COMMANDS = { approve: "approve", reject: "reject" } as const

/** The badge value of a row that waits for the owner. */
export const WAITS_FOR_OWNER = "owner"

/** One row of the attention list: an order the owner has to look at. */
export interface AttentionRow {
    /** The order id. */
    readonly id: string
    /** The order number and the customer. */
    readonly title: string
    /** What was ordered and its amount. */
    readonly description: string
    /** Why it needs attention, as a stable code the spec gives words to. */
    readonly reason: string
}

const titleOf = (order: WaitingOrder): string =>
    order.customer === null ? order.orderNo : `${order.orderNo} · ${order.customer}`

/** The orders that wait for the owner as the attention list reads them. */
export const attentionRowsOf = (orders: ReadonlyArray<WaitingOrder>): ReadonlyArray<AttentionRow> =>
    orders.map((order) => ({
        id: order.id,
        title: titleOf(order),
        description: [order.items, moneyLine(order.amountVnd)].filter((part) => part !== "").join(" · "),
        reason: WAITS_FOR_OWNER,
    }))

const rowOf = (order: WaitingOrder): DecisionRowView => ({
    id: order.id,
    title: titleOf(order),
    description: order.items,
    badges: [],
    reason: null,
    amount: order.amountVnd === null ? null : moneyLine(order.amountVnd),
    proposal: order.items,
    trace: null,
    expiry: null,
    primary: { id: SALES_DECISION_COMMANDS.approve, label: SALES_DECISION_COMMANDS.approve },
    edit: null,
    menu: [{ id: SALES_DECISION_COMMANDS.reject, label: SALES_DECISION_COMMANDS.reject, isDanger: true }],
    waitingFor: null,
})

/** The orders that wait for the owner as the decision queue reads them; `total` counts every waiting order. */
export const salesDecisionQueueOf = (orders: ReadonlyArray<WaitingOrder>, total: number): DecisionQueueView => ({
    count: total === 0 ? null : String(total),
    more: null,
    rows: orders.map(rowOf),
})
