import { PaymentOrderRequestEntity } from "./payment-order-request.entity"

export { PaymentOrderRequestEntity }

/** The entities of the payment-order-requests capability, registered on the primary connection. */
export const paymentOrderRequestsEntities = [PaymentOrderRequestEntity] as const
