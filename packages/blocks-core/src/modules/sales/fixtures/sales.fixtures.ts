import type { CountsResult, ListPage } from "@nivo-lite/agent-sdk/block"
import { attentionRowsOf, salesDecisionQueueOf } from "../../../rules/sales/decisions"
import { salesFiguresOf } from "../../../rules/sales/figures"
import { orderSummaryOf } from "../../../rules/sales/lead-orders"
import { waitsForOwner } from "../../../rules/sales/order-confirm"
import { ORDER_STATUSES } from "../../../rules/sales/order-status"
import { SALES_SETTINGS_DEFAULTS } from "../../../rules/sales/settings"
import { LEAD_STAGES } from "../../../rules/sales/stage"
import { waitingViewOf } from "../../../rules/sales/waiting"
import type { WaitingView } from "../../../rules/sales/waiting"
import { WAITING_SHOWN } from "../constants"
import { leadDetailOf, orderDetailOf } from "../details"
import { waitingHrefOf } from "../reads/orders-waiting.read"
import type { ModuleFixtures } from "../../module-fixtures"
import type { OrderRow } from "../sales.types"
import { LEAD_PROPOSAL, ORDER_CONFIRMED, ORDER_WAITING, SAMPLE_LEADS, SAMPLE_ORDERS } from "./sales.data"

const countsOf = (values: ReadonlyArray<string>, keys: ReadonlyArray<string>): CountsResult => ({
    counts: Object.fromEntries(keys.map((key) => [key, values.filter((value) => value === key).length])),
    total: values.length,
})

const NAMES: Readonly<Record<string, string>> = Object.fromEntries(
    SAMPLE_LEADS.map((lead) => [lead.id, lead.contactName]),
)

/** The name of the customer of a sample order; null for an order with no customer or one whose customer is gone. */
export const customerOf = (order: OrderRow): string | null =>
    order.leadId === null ? null : (NAMES[order.leadId] ?? null)

const waitingOrders = SAMPLE_ORDERS.filter((order) => waitsForOwner(order, SALES_SETTINGS_DEFAULTS))

/** The names of the stages and statuses with zero rows, for the counts of nothing. */
const zeroCounts = (keys: ReadonlyArray<string>): CountsResult => ({
    counts: Object.fromEntries(keys.map((key) => [key, 0])),
    total: 0,
})

const NO_ROWS: ListPage<never> = { rows: [], cursor: null }

const WAITING_ORDERS = waitingOrders.map((order) => ({
    id: order.id,
    orderNo: order.orderNo,
    items: order.items,
    amountVnd: order.amountVnd,
    customer: customerOf(order),
}))

const STAGE_COUNTS = countsOf(
    SAMPLE_LEADS.map((lead) => lead.stage),
    LEAD_STAGES,
).counts

const WAITING_VIEW: WaitingView = waitingViewOf(
    waitingOrders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        items: order.items,
        amountVnd: order.amountVnd,
        customer: customerOf(order),
    })),
    waitingOrders.length,
    WAITING_SHOWN,
    waitingHrefOf,
)

/**
 * The Sales reads in the states a prototype draws (ready, empty, and the draft order that waits for the owner) and the answer of
 * each action. Built from one set of sample customers and orders through the module's own mappers. Loading and error need no data.
 */
export const SALES_FIXTURES: ModuleFixtures = {
    reads: {
        "sales.leads": { ready: { rows: SAMPLE_LEADS, cursor: null }, empty: NO_ROWS },
        "sales.lead-counts": {
            ready: countsOf(
                SAMPLE_LEADS.map((lead) => lead.stage),
                LEAD_STAGES,
            ),
            empty: zeroCounts(LEAD_STAGES),
        },
        "sales.lead": {
            ready: leadDetailOf(
                LEAD_PROPOSAL,
                orderSummaryOf(SAMPLE_ORDERS.filter((order) => order.leadId === LEAD_PROPOSAL.id)),
            ),
            empty: null,
        },
        "sales.orders": { ready: { rows: SAMPLE_ORDERS, cursor: null }, empty: NO_ROWS },
        "sales.order-counts": {
            ready: countsOf(
                SAMPLE_ORDERS.map((order) => order.status),
                ORDER_STATUSES,
            ),
            empty: zeroCounts(ORDER_STATUSES),
        },
        "sales.order": {
            ready: orderDetailOf(ORDER_CONFIRMED, customerOf(ORDER_CONFIRMED), SALES_SETTINGS_DEFAULTS),
            empty: null,
            waiting: orderDetailOf(ORDER_WAITING, customerOf(ORDER_WAITING), SALES_SETTINGS_DEFAULTS),
        },
        "sales.figures": {
            ready: salesFiguresOf(STAGE_COUNTS, SAMPLE_ORDERS),
            empty: salesFiguresOf({}, []),
        },
        "sales.attention": {
            ready: { rows: attentionRowsOf(WAITING_ORDERS), cursor: null },
            empty: NO_ROWS,
        },
        "sales.decisions": {
            ready: salesDecisionQueueOf(WAITING_ORDERS, WAITING_ORDERS.length),
            empty: salesDecisionQueueOf([], 0),
        },
        "sales.settings": { ready: SALES_SETTINGS_DEFAULTS, empty: null },
        "sales.orders-waiting": { ready: WAITING_VIEW, empty: waitingViewOf([], 0, WAITING_SHOWN, waitingHrefOf) },
    },
    actions: {
        "sales.move-stage": { ok: true, data: { stage: "qualified" } },
        "sales.confirm-order": { ok: true, data: { changed: true } },
        "sales.cancel-order": { ok: true },
        "sales.save-settings": { ok: true },
        "sales.decide": { ok: true, data: { changed: true } },
    },
}
