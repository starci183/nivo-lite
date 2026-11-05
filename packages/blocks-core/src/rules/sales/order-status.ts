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

/** Whether an order may still be cancelled: only a draft. */
export const canCancel = (status: OrderStatus): boolean => status === "draft"
