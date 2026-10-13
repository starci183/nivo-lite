import type { PaymentOrderRequestStatusLookup } from "@modules/domain/payment-order-requests"
import type { PaymentOrderRequestStatusRequest } from "../../application/payment-order-request-status.contracts"
import type { PaymentOrderRequestStatusInput } from "./dto/payment-order-request-status.input"
import type { PaymentOrderRequestStatusType } from "./dto/payment-order-request-status.type"

/** Maps the caller's request selector and workspace header to the status query. */
export const toPaymentOrderRequestStatusRequest = (
    input: PaymentOrderRequestStatusInput,
    workspaceId: string,
): PaymentOrderRequestStatusRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps an authorized domain status or an absent request to the GraphQL result. */
export const toPaymentOrderRequestStatusType = (
    result: PaymentOrderRequestStatusLookup,
): PaymentOrderRequestStatusType | null => result
