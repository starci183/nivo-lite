import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { TOOL } from "@nivo-lite/blocks-core"
import type { NodeRow } from "@modules/domain/graph-nodes"

/** The records of the shop by data kind. */
export type Store = Record<string, Array<NodeRow>>

/** The amount from which the owner approves an order before it is confirmed (the order tool's own rule). */
export const OWNER_LIMIT_VND = 5_000_000

/** The rows of a data kind of the store, created on first use. */
export const rowsOf = (store: Store, kind: string): Array<NodeRow> => (store[kind] ??= [])

/** Notes an effect the shop ran, and answers the subject it touched. */
export type RecordEffect = (effect: string, payload: EffectPayload, kind: string, id: string) => SubjectRef

/** What the shop's own tools work on: its records, and the note of each effect they run. */
interface Desk {
    readonly store: Store
    readonly record: RecordEffect
}

const patch = (rows: Array<NodeRow>, id: unknown, change: Record<string, unknown>): void => {
    const at = rows.findIndex((row) => row.id === id)
    const found = rows[at]
    if (found !== undefined) rows[at] = { ...found, ...change }
}

const add = (store: Store, kind: string, row: NodeRow): string => {
    const rows = rowsOf(store, kind)
    const id = `${kind}-${rows.length + 1}`
    rows.push({ id, ...row })
    return id
}

/** The order of an id, or undefined. */
export const orderOf = (store: Store, id: unknown): NodeRow | undefined =>
    rowsOf(store, "order").find((row) => row.id === id)

/**
 * The lines of an order as the order tool prices them: the agent names catalogue items and quantities only, the name and the unit price
 * are read from the shop's catalogue.
 */
const orderLinesOf = (store: Store, items: unknown): ReadonlyArray<Record<string, unknown>> => {
    if (!Array.isArray(items)) return []
    return items.flatMap((item: unknown) => {
        if (typeof item !== "object" || item === null) return []
        const row = rowsOf(store, "catalogue-item").find((each) => each.id === Reflect.get(item, "catalogueItemId"))
        if (row === undefined) return []
        const qty = Number(Reflect.get(item, "qty"))
        const unitVnd = Number(row.priceVnd)
        return [{ name: row.name, qty, unitVnd, amountVnd: qty * unitVnd }]
    })
}

/** The answer of a tool that refuses: a fact with the true numbers, never a throw. */
const refusalOf = (reason: string, facts: Readonly<Record<string, unknown>>): SubjectRef => ({
    kind: "refused",
    id: reason,
    facts: { ...facts },
})

/** The transfer content of an order number, as the QR carries it. */
export const transferCodeOf = (orderNo: unknown): string =>
    String(orderNo)
        .replaceAll(/[^A-Za-z0-9]/g, "")
        .toUpperCase()

/** What the order tools answer about an order: the true numbers are the tool's. */
const orderFactsOf = (order: NodeRow | undefined): Readonly<Record<string, unknown>> => ({
    orderNo: order?.orderNo,
    status: order?.status,
    amountVnd: order?.amountVnd,
    thresholdVnd: OWNER_LIMIT_VND,
})

/** Records a draft order, priced from the catalogue. */
const recordOrder = (desk: Desk, effect: string, payload: EffectPayload): SubjectRef => {
    const n = rowsOf(desk.store, "order").length + 1
    const lines = orderLinesOf(desk.store, payload.items)
    const id = add(desk.store, "order", {
        orderNo: `DH-20261109-000${n}`,
        leadId: payload.leadId,
        items: { lines },
        amountVnd: lines.reduce((sum, line) => sum + Number(line.amountVnd), 0),
        address: payload.address,
        status: "draft",
        approved: false,
        shippedAt: null,
        confirmedAt: null,
        createdAt: "2026-11-04T10:00:00.000Z",
    })
    return { ...desk.record(effect, payload, "order", id), facts: orderFactsOf(orderOf(desk.store, id)) }
}

/** Confirms an order. The owner's rule lives here: an order at or over the limit is confirmed only once the owner approved it. */
const confirmOrder = (desk: Desk, effect: string, payload: EffectPayload): SubjectRef => {
    const order = orderOf(desk.store, payload.orderId)
    if (Number(order?.amountVnd) >= OWNER_LIMIT_VND && order?.approved !== true)
        return refusalOf("waits_owner", orderFactsOf(order))
    const confirmed = { status: "confirmed", confirmedAt: "2026-11-04T10:00:30.000Z" }
    patch(rowsOf(desk.store, "order"), payload.orderId, confirmed)
    const facts = orderFactsOf(orderOf(desk.store, payload.orderId))
    return { ...desk.record(effect, payload, "order", String(payload.orderId)), facts }
}

/**
 * Settles an order the way the payment tool does: only a real, unused bank transaction settles an open order, and the tool never judges
 * the amount (short or over); it answers the true numbers `{ expectedVnd, receivedVnd, differenceVnd }` for the agent to decide on.
 */
const markPaid = (desk: Desk, effect: string, payload: EffectPayload): SubjectRef => {
    const order = orderOf(desk.store, payload.orderId)
    const transfer = rowsOf(desk.store, "bank-transaction").find((row) => row.id === payload.transactionId)
    if (order === undefined || transfer === undefined) return refusalOf("not_found", {})
    const expectedVnd = Number(order.amountVnd)
    const receivedVnd = Number(transfer.amountVnd)
    const facts = { expectedVnd, receivedVnd, differenceVnd: receivedVnd - expectedVnd }
    if (typeof transfer.orderId === "string") return refusalOf("transaction_used", facts)
    patch(rowsOf(desk.store, "order"), payload.orderId, { status: "paid" })
    const matched = { orderId: payload.orderId, status: "matched" }
    patch(rowsOf(desk.store, "bank-transaction"), payload.transactionId, matched)
    return { ...desk.record(effect, payload, "order", String(payload.orderId)), facts }
}

/** Ensures the shop's one customer is a lead. */
const ensureLead = (desk: Desk, effect: string, payload: EffectPayload): SubjectRef => {
    if (rowsOf(desk.store, "sales-lead").length === 0)
        rowsOf(desk.store, "sales-lead").push({ id: "lead-1", consultStage: null, consultFacts: {} })
    return desk.record(effect, payload, "sales-lead", "lead-1")
}

const updateLead = (desk: Desk, effect: string, payload: EffectPayload): SubjectRef => {
    const { leadId, ...change } = payload
    patch(rowsOf(desk.store, "sales-lead"), leadId, change)
    return desk.record(effect, payload, "sales-lead", String(leadId))
}

/** The tools of the shop that write a record, by effect: each changes the store the way the app's executor does. */
const WRITERS: Readonly<Record<string, (desk: Desk, effect: string, payload: EffectPayload) => SubjectRef>> = {
    [TOOL.leadEnsure]: ensureLead,
    [TOOL.leadUpdate]: updateLead,
    [TOOL.orderRecord]: recordOrder,
    [TOOL.orderConfirm]: confirmOrder,
    [TOOL.paymentMarkPaid]: markPaid,
    [TOOL.paymentClaimRecord]: (desk, effect, payload) =>
        desk.record(effect, payload, "payment-claim", add(desk.store, "payment-claim", { ...payload, status: "open" })),
    [TOOL.workItemRaise]: (desk, effect, payload) =>
        desk.record(effect, payload, "work-item", add(desk.store, "work-item", payload)),
}

/**
 * Runs an effect of the shop that writes a record (a lead, an order, a payment, a claim, an owner item) and answers the subject it
 * touched, a refusal included; null for an effect that writes none (a send, a tag, a post).
 */
export const writeOf = (
    store: Store,
    record: RecordEffect,
    effect: string,
    payload: EffectPayload,
): SubjectRef | null => {
    const writer = WRITERS[effect]
    return writer === undefined ? null : writer({ store, record }, effect, payload)
}
