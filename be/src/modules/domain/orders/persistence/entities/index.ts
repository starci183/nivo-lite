import { OrderEntity } from "./order.entity"

export { OrderEntity }

/** The entities of the orders capability, registered on the primary connection. */
export const ordersEntities: readonly [typeof OrderEntity] = [OrderEntity] as const
