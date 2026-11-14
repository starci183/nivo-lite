import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { PayosClient } from "./payos.client"
import type { PayosOptions } from "./payos.options"

/** Token of the payOS client. */
export const PAYOS: unique symbol = Symbol("integrations.payos")

/** Token of the options of the payOS integration, exported so a spec can provide it. */
export const PAYOS_OPTIONS: unique symbol = Symbol("integrations.payos.options")

/** Injects the options of the payOS integration. Parameter type: PayosOptions. */
export const InjectPayosOptions = (): TypedParameterDecorator<PayosOptions> => injector<PayosOptions>(PAYOS_OPTIONS)

/** Injects the payOS client. Parameter type: PayosClient. */
export const InjectPayos = (): TypedParameterDecorator<PayosClient> => injector<PayosClient>(PAYOS)
