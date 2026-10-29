import { paymentOrdersEntities } from "@modules/domain/payment-orders"

const [PaymentOrderEntity] = paymentOrdersEntities
type PaymentOrderEntity = InstanceType<typeof PaymentOrderEntity>

/** The instant the payment-order specs treat as now. */
export const PAYMENT_ORDER_NOW = "2026-10-12T10:00:00.000Z"

/** A pending plan payment order row as the entity API returns it, with any column overridden. */
export const paymentOrderRowOf = (overrides: Partial<PaymentOrderEntity> = {}): PaymentOrderEntity =>
    Object.assign(
        new PaymentOrderEntity(),
        {
            id: "order-1",
            workspaceId: "ws-1",
            planCode: "starter",
            amountVnd: 990000,
            orderCode: "NIVO8F3K2",
            status: "pending" as const,
            expiresAt: new Date("2026-10-12T10:30:00.000Z"),
            paidAt: null,
            createdAt: new Date(PAYMENT_ORDER_NOW),
            kind: "plan" as const,
            packCode: null,
            detail: {},
        },
        overrides,
    )

/** A second listed order of the workspace. */
export const SECOND_ROW = paymentOrderRowOf({ id: "order-2" })

/** A pending order whose deadline passed a millisecond before the clock's instant. */
export const LAPSED_ROW = paymentOrderRowOf({ expiresAt: new Date("2026-10-12T09:59:59.999Z") })

/** A pending order whose deadline is exactly the clock's instant. */
export const AT_DEADLINE_ROW = paymentOrderRowOf({ expiresAt: new Date(PAYMENT_ORDER_NOW) })

/** A paid order whose deadline lapsed before it was paid at the clock's instant. */
export const PAID_LAPSED_ROW = paymentOrderRowOf({
    status: "paid",
    expiresAt: new Date("2026-10-12T09:59:59.999Z"),
    paidAt: new Date(PAYMENT_ORDER_NOW),
})
