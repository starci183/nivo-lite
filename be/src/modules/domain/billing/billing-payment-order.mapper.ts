import type { BillingPaymentOrder, PayableOrder } from "./billing.contracts"

/** Maps the order and payment instructions to the GraphQL shape. */
export const paymentInstructionsOf = (result: PayableOrder): BillingPaymentOrder => ({
    ...result.order,
    qrUrl: result.qrUrl,
    bank: { ...result.bank },
    detail: {
        credits: typeof result.order.detail.credits === "number" ? result.order.detail.credits : null,
        from: typeof result.order.detail.from === "string" ? result.order.detail.from : null,
        to: typeof result.order.detail.to === "string" ? result.order.detail.to : null,
        fromPrice: typeof result.order.detail.fromPrice === "number" ? result.order.detail.fromPrice : null,
        toPrice: typeof result.order.detail.toPrice === "number" ? result.order.detail.toPrice : null,
        credit: typeof result.order.detail.credit === "number" ? result.order.detail.credit : null,
        daysLeft: typeof result.order.detail.daysLeft === "number" ? result.order.detail.daysLeft : null,
        paidUntil: typeof result.order.detail.paidUntil === "string" ? result.order.detail.paidUntil : null,
    },
})
