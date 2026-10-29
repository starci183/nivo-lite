import { ordersEntities } from "@modules/domain/orders"
import { entityOf } from "./entity.builder"

const [OrderEntity] = ordersEntities

/** An order that only shows its number. */
export const numberedOrderOf = entityOf(OrderEntity, { id: "o-1", orderNo: "DH-1" })

/** A confirmed order with its items and a price. */
export const summarisedOrderOf = entityOf(OrderEntity, {
    id: "o-1",
    orderNo: "DH-1",
    items: "tea",
    amountVnd: 5000,
    status: "confirmed",
})

/** The same order under another id, without a price. */
export const unpricedOrderOf = () => summarisedOrderOf({ id: "o-2", amountVnd: null })
