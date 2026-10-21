import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { CustomerTurnsOptions } from "./customer-turns.options"

/** Token of the customer-turns options, exported so a spec can provide it. */
export const CUSTOMER_TURNS_OPTIONS: unique symbol = Symbol("domain.customer-turns.options")

/** Injects the options of the customer turns. Parameter type: CustomerTurnsOptions. */
export const InjectCustomerTurnsOptions = (): TypedParameterDecorator<CustomerTurnsOptions> =>
    injector<CustomerTurnsOptions>(CUSTOMER_TURNS_OPTIONS)
