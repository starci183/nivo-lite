/** Where an order stands. */
export type OrderStatus = "draft" | "confirmed" | "invoiced" | "paid" | "cancelled" | "failed_system"

/** Every status of an order. */
export const ORDER_STATUSES: readonly ["draft", "confirmed", "invoiced", "paid", "cancelled", "failed_system"] = [
    "draft",
    "confirmed",
    "invoiced",
    "paid",
    "cancelled",
    "failed_system",
]

/** The statuses in which an order waits for money. */
export const AWAITING_PAYMENT_STATUSES: ReadonlyArray<OrderStatus> = ["confirmed", "invoiced"]

/** The statuses from which an order may ship. */
export const SHIPPABLE_STATUSES: ReadonlyArray<OrderStatus> = ["confirmed", "invoiced", "paid"]

/** The statuses of an order that count as the customer's: not cancelled and not cut short by a system failure. */
export const LIVE_STATUSES: ReadonlyArray<OrderStatus> = ["draft", "confirmed", "invoiced", "paid"]

/** The statuses of an order the shop has confirmed. */
export const CONFIRMED_STATUSES: ReadonlyArray<OrderStatus> = ["confirmed", "invoiced", "paid"]

const KNOWN_STATUSES: ReadonlyArray<string> = ORDER_STATUSES

/** Whether a text names an order status. */
export const isOrderStatus = (value: string): value is OrderStatus => KNOWN_STATUSES.includes(value)

/** Whether an order of this status waits for money. */
export const isAwaitingPayment = (status: OrderStatus): boolean => AWAITING_PAYMENT_STATUSES.includes(status)

/** Whether an order may be handed to a carrier: its status allows it and it has not shipped yet. */
export const canShip = (status: OrderStatus, shippedAt: string | null): boolean =>
    SHIPPABLE_STATUSES.includes(status) && shippedAt === null

/** Whether an order may be confirmed: only a draft. */
export const canConfirm = (status: OrderStatus): boolean => status === "draft"

/** What decides whether an order may be cancelled: where it stands, how many payments were allocated to it and whether an invoice was issued for it. */
export interface CancelFacts {
    /** Where the order stands. */
    readonly status: OrderStatus
    /** How many payments (bank transactions) are allocated to the order. */
    readonly allocations: number
    /** How many invoices were issued for the order. */
    readonly invoices: number
}

/** Why an order may not be cancelled; each reason has its words in the module's catalogue. */
export type CancelRefusal =
    "order_not_cancellable" | "order_paid" | "order_invoiced" | "order_has_payment" | "order_has_invoice"

/** The verdict on cancelling an order: allowed, or the reason it is refused. */
export type CancelVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: CancelRefusal }

/**
 * Whether an order may be cancelled: a draft may; a confirmed order may while no payment is allocated to it and no invoice was issued
 * for it. A paid or an invoiced order, a confirmed one with a payment or an invoice, and an order already cancelled or cut short may not.
 */
export const cancelVerdictOf = (facts: CancelFacts): CancelVerdict => {
    if (facts.status === "draft") return { ok: true }
    if (facts.status === "paid") return { ok: false, reason: "order_paid" }
    if (facts.status === "invoiced") return { ok: false, reason: "order_invoiced" }
    if (facts.status !== "confirmed") return { ok: false, reason: "order_not_cancellable" }
    if (facts.allocations > 0) return { ok: false, reason: "order_has_payment" }
    return facts.invoices > 0 ? { ok: false, reason: "order_has_invoice" } : { ok: true }
}
