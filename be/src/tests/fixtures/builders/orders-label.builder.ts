import { ordersEntities } from "@modules/domain/orders"
import { entityOf } from "./entity.builder"

const OrderEntity: (typeof ordersEntities)[0] = ordersEntities[0]
type OrderEntity = InstanceType<typeof OrderEntity>

/** An order that only shows its number. */
export const numberedOrderOf: (overrides?: Partial<OrderEntity>) => OrderEntity = entityOf(OrderEntity, {
    id: "o-1",
    orderNo: "DH-1",
})

/** A confirmed order with its items and a price. */
export const summarisedOrderOf: (overrides?: Partial<OrderEntity>) => OrderEntity = entityOf(OrderEntity, {
    id: "o-1",
    orderNo: "DH-1",
    items: "tea",
    amountVnd: 5000,
    status: "confirmed",
})

/** The same order under another id, without a price. */
export const unpricedOrderOf = (): OrderEntity => summarisedOrderOf({ id: "o-2", amountVnd: null })
