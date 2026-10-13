import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { BillingOptions } from "./billing.options"

/** Token of the billing options, exported so a spec can provide it. */
export const BILLING_OPTIONS: unique symbol = Symbol("domain.billing.options")

/** Injects the options of the billing capability. Parameter type: BillingOptions. */
export const InjectBillingOptions = (): TypedParameterDecorator<BillingOptions> =>
    injector<BillingOptions>(BILLING_OPTIONS)
