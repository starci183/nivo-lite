import type { BillingPaymentOrderLookup } from "@modules/domain/billing"
import type { OpenPlanPaymentOrderRequest } from "../../application/open-plan-payment-order.contracts"
import type { BillingPaymentOrderType } from "./dto/billing-payment-order.type"

/** Maps the GraphQL selector to the query request. */
export const toOpenPlanPaymentOrderRequest = (workspaceId: string): OpenPlanPaymentOrderRequest => ({ workspaceId })

/** Maps the domain answer to the GraphQL contract. */
export const toOpenPlanPaymentOrderType = (result: BillingPaymentOrderLookup): BillingPaymentOrderType | null => result
