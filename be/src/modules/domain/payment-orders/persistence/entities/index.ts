import { PaymentOrderEntity } from "./payment-order.entity"

export { PaymentOrderEntity }

/** The entities of the payment-orders capability, registered on the primary connection. */
export const paymentOrdersEntities = [PaymentOrderEntity] as const
