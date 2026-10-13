import type { PaymentOrderRequestParams, QueuedPaymentOrderRequest } from "@modules/domain/payment-order-requests"
import type { RequestPaymentOrderInput } from "./dto/request-payment-order.input"
import type { RequestPaymentOrderType } from "./dto/request-payment-order.type"

/** Maps the selected workspace and bounded GraphQL arguments to the command request. */
export const toRequestPaymentOrderRequest = (
    input: RequestPaymentOrderInput,
    workspaceId: string,
): PaymentOrderRequestParams => ({
    workspaceId,
    kind: input.kind,
    target: input.target,
    cycle: input.cycle,
    tierCredits: input.tierCredits,
    seats: input.seats,
})

/** Maps the immediate queue acknowledgement to the GraphQL result. */
export const toRequestPaymentOrderType = (result: QueuedPaymentOrderRequest): RequestPaymentOrderType => ({
    id: result.id,
    status: result.status,
})
