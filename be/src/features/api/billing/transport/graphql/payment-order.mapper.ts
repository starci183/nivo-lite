import type { BillingPaymentOrderLookup } from "@modules/domain/billing"
import type { PaymentOrderRequest } from "../../application/payment-order.contracts"
import type { BillingPaymentOrderType } from "./dto/billing-payment-order.type"
import type { PaymentOrderInput } from "./dto/payment-order.input"

/** Maps the GraphQL selector to the query request. */
export const toPaymentOrderRequest = (workspaceId: string, input: PaymentOrderInput): PaymentOrderRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps the domain answer to the GraphQL contract. */
export const toPaymentOrderType = (result: BillingPaymentOrderLookup): BillingPaymentOrderType | null => result
