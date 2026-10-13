import type { PaymentOrder } from "./payment-orders.contracts"

/** The order as the customer should see it: a pending order past its time is expired, whether or not anything has flipped it yet. */
export const withLazyExpiry = (order: PaymentOrder, now: Date): PaymentOrder =>
    order.status === "pending" && new Date(order.expiresAt).getTime() < now.getTime()
        ? { ...order, status: "expired" }
        : order
