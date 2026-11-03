import { OrderEntity } from "./order.entity"
import { PaymentClaimEntity } from "./payment-claim.entity"

export { OrderEntity, PaymentClaimEntity }

/** The entities of the orders capability, registered on the primary connection. */
export const ordersEntities: readonly [typeof OrderEntity, typeof PaymentClaimEntity] = [
    OrderEntity,
    PaymentClaimEntity,
] as const
