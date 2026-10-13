import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { CodeDelivery } from "./loyalty.contracts"

/** Token of the delivery of one-time codes into the chat of a customer. */
export const LOYALTY_CODE_DELIVERY: unique symbol = Symbol("domain.loyalty.code-delivery")

/** Injects the delivery of one-time codes. Parameter type: CodeDelivery. */
export const InjectCodeDelivery = (): TypedParameterDecorator<CodeDelivery> =>
    injector<CodeDelivery>(LOYALTY_CODE_DELIVERY)
