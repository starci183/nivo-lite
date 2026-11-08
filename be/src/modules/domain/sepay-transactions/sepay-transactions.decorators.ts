import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { PaidOrderFulfilment } from "./sepay-transactions.port"

/** Token of the fulfilment of settled orders: absent until a capability that sells through an order binds one. */
export const PAID_ORDER_FULFILMENT: unique symbol = Symbol("domain.sepay-transactions.paid-order-fulfilment")

/** Injects the fulfilment of settled orders. Parameter type: PaidOrderFulfilment. */
export const InjectPaidOrderFulfilment = (): TypedParameterDecorator<PaidOrderFulfilment> =>
    injector<PaidOrderFulfilment>(PAID_ORDER_FULFILMENT)
