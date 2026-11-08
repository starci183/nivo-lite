import type { DecisionQueueView, DecisionRowView } from "../../views/views.types"
import { moneyLine } from "./money"
import type { WaitingOrder } from "./waiting"

/** The command ids of a sales decision. */
export const SALES_DECISION_COMMANDS = { approve: "approve", reject: "reject" } as const

const titleOf = (order: WaitingOrder): string =>
    order.customer === null ? order.orderNo : `${order.orderNo} \u00b7 ${order.customer}`

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
    rows: orders.map((order) => rowOf(order)),
})
