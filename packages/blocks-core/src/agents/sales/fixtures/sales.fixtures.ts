import type { CountsResult, ListPage } from "@nivo-lite/agent-sdk/block"
import { salesDecisionQueueOf } from "../rules/decisions"
import { awaitingRowsOf, needsRowsOf, overdueRowsOf, ownerRowsOf } from "../rules/attention"
import { salesFiguresOf, type OrderTotals } from "../rules/figures"
import { orderSummaryOf } from "../rules/lead-orders"
import { waitsForOwner } from "../rules/order-confirm"
import { CONFIRMED_STATUSES, ORDER_STATUSES } from "../rules/order-status"
import { SALES_SETTINGS_DEFAULTS } from "../rules/settings"
import { LEAD_STAGES } from "../rules/stage"
import { waitingViewOf, type WaitingView } from "../rules/waiting"
import { WAITING_SHOWN } from "../constants"
import { leadDetailOf, orderDetailOf } from "../details"
import { waitingHrefOf } from "../reads/orders-waiting.read"
import type { ModuleFixtures } from "../../../shared/modules/module-fixtures"
import { ACCOUNTING_FIXTURES } from "../ledger/fixtures/accounting.fixtures"
import { LOYALTY_FIXTURES } from "../loyalty/fixtures/loyalty.fixtures"
import type { LeadRow, OrderRow } from "../sales.types"
import { LEAD_PROPOSAL, ORDER_CONFIRMED, ORDER_WAITING, SAMPLE_LEADS, SAMPLE_ORDERS } from "./sales.data"

const countsOf = (values: ReadonlyArray<string>, keys: ReadonlyArray<string>): CountsResult => ({
    counts: Object.fromEntries(keys.map((key) => [key, values.filter((value) => value === key).length])),
    total: values.length,
})

const LEADS_BY_CONTACT: Readonly<Record<string, LeadRow>> = Object.fromEntries(
    SAMPLE_LEADS.flatMap((lead) => (lead.contactId === null ? [] : [[lead.contactId, lead]])),
)

/** The name of the customer of a sample order; null for an order with no customer or one whose customer is gone. */
export const customerOf = (order: OrderRow): string | null =>
    order.contactId === null ? null : (LEADS_BY_CONTACT[order.contactId]?.contactName ?? null)

/** The sample customer record of an order's person; null for none. */
const leadIdOf = (order: OrderRow): string | null =>
    order.contactId === null ? null : (LEADS_BY_CONTACT[order.contactId]?.id ?? null)

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
    items: order.itemsText,
    amountVnd: order.amountVnd,
    customer: customerOf(order),
}))

const STAGE_COUNTS = countsOf(
    SAMPLE_LEADS.map((lead) => lead.stage),
    LEAD_STAGES,
).counts

const sumOf = (orders: ReadonlyArray<OrderRow>): number =>
    orders.reduce((total, order) => total + Number(order.amountVnd), 0)

const DRAFTS = SAMPLE_ORDERS.filter((order) => order.status === "draft")
const CLOSED = SAMPLE_ORDERS.filter((order) => CONFIRMED_STATUSES.includes(order.status))

const TOTALS: OrderTotals = {
    draftCount: DRAFTS.length,
    draftVnd: sumOf(DRAFTS),
    closedCount: CLOSED.length,
    closedVnd: sumOf(CLOSED),
}

const WAITING_VIEW: WaitingView = waitingViewOf(
    waitingOrders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        items: order.itemsText,
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
const OWN_FIXTURES: ModuleFixtures = {
    reads: {
        "blocks-core.sales.api.lead.list": { ready: { rows: SAMPLE_LEADS, cursor: null }, empty: NO_ROWS },
        "blocks-core.sales.api.lead.counts": {
            ready: countsOf(
                SAMPLE_LEADS.map((lead) => lead.stage),
                LEAD_STAGES,
            ),
            empty: zeroCounts(LEAD_STAGES),
        },
        "blocks-core.sales.api.lead.get": {
            ready: leadDetailOf(
                LEAD_PROPOSAL,
                orderSummaryOf(SAMPLE_ORDERS.filter((order) => order.contactId === LEAD_PROPOSAL.contactId)),
            ),
            empty: null,
        },
        "blocks-core.sales.api.order.list": { ready: { rows: SAMPLE_ORDERS, cursor: null }, empty: NO_ROWS },
        "blocks-core.sales.api.order.counts": {
            ready: countsOf(
                SAMPLE_ORDERS.map((order) => order.status),
                ORDER_STATUSES,
            ),
            empty: zeroCounts(ORDER_STATUSES),
        },
        "blocks-core.sales.api.order.get": {
            ready: orderDetailOf(ORDER_CONFIRMED, leadIdOf(ORDER_CONFIRMED), customerOf(ORDER_CONFIRMED), SALES_SETTINGS_DEFAULTS, true),
            empty: null,
            waiting: orderDetailOf(ORDER_WAITING, leadIdOf(ORDER_WAITING), customerOf(ORDER_WAITING), SALES_SETTINGS_DEFAULTS, true),
        },
        "blocks-core.sales.api.order.figures": {
            ready: salesFiguresOf(STAGE_COUNTS, TOTALS),
            empty: salesFiguresOf({}, { draftCount: 0, draftVnd: 0, closedCount: 0, closedVnd: 0 }),
        },
        "blocks-core.sales.api.lead.attention": {
            ready: {
                rows: [
                    ...overdueRowsOf(SAMPLE_LEADS.filter((lead) => lead.nextDueAt !== null)),
                    ...needsRowsOf(SAMPLE_LEADS.filter((lead) => lead.needs !== null)),
                    ...ownerRowsOf(WAITING_ORDERS),
                ],
                cursor: null,
            },
            empty: NO_ROWS,
        },
        "blocks-core.sales.api.lead.awaiting-reply": {
            ready: { rows: awaitingRowsOf(SAMPLE_LEADS.filter((lead) => lead.awaitingSince !== null)), cursor: null },
            empty: NO_ROWS,
        },
        "blocks-core.sales.api.order.decisions": {
            ready: salesDecisionQueueOf(WAITING_ORDERS, WAITING_ORDERS.length),
            empty: salesDecisionQueueOf([], 0),
        },
        "blocks-core.sales.api.settings.get": { ready: SALES_SETTINGS_DEFAULTS, empty: null },
        "blocks-core.sales.api.order.waiting": { ready: WAITING_VIEW, empty: waitingViewOf([], 0, WAITING_SHOWN, waitingHrefOf) },
    },
    actions: {
        "sales.move-stage": { ok: true, data: { stage: "qualified" } },
        "sales.confirm-order": { ok: true, data: { changed: true } },
        "sales.cancel-order": { ok: true },
        "sales.save-settings": { ok: true },
        "sales.decide": { ok: true, data: { changed: true } },
        "sales.respond": { ok: true },
        "sales.follow": { ok: true },
        "sales.reply": { ok: true },
    },
}

/** The fixtures of the Sales module: its own reads and actions, then those of its ledger area (the books of the sale) and its loyalty area. */
export const SALES_FIXTURES: ModuleFixtures = {
    reads: { ...OWN_FIXTURES.reads, ...ACCOUNTING_FIXTURES.reads, ...LOYALTY_FIXTURES.reads },
    actions: { ...OWN_FIXTURES.actions, ...ACCOUNTING_FIXTURES.actions, ...LOYALTY_FIXTURES.actions },
}
