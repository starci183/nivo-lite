import type { BillingPaymentOrder } from "@modules/domain/billing"
import type { PaymentOrdersRequest } from "../../application/payment-orders.contracts"
import type { BillingPaymentOrderType } from "./dto/billing-payment-order.type"

/** Maps the GraphQL selector to the query request. */
export const toPaymentOrdersRequest = (workspaceId: string): PaymentOrdersRequest => ({ workspaceId })

/** Maps the domain answer to the GraphQL contract. */
export const toPaymentOrdersType = (
    result: ReadonlyArray<BillingPaymentOrder>,
): ReadonlyArray<BillingPaymentOrderType> => result
