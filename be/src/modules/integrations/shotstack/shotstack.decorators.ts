import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { ShotstackClient } from "./shotstack.client"
import type { ShotstackOptions } from "./shotstack.options"

/** Token of the Shotstack client. */
export const SHOTSTACK: unique symbol = Symbol("integrations.shotstack")

/** Token of the options of the Shotstack integration, exported so a spec can provide it. */
export const SHOTSTACK_OPTIONS: unique symbol = Symbol("integrations.shotstack.options")

/** Injects the options of the Shotstack integration. Parameter type: ShotstackOptions. */
export const InjectShotstackOptions = (): TypedParameterDecorator<ShotstackOptions> =>
    injector<ShotstackOptions>(SHOTSTACK_OPTIONS)

/** Injects the Shotstack client. Parameter type: ShotstackClient. */
export const InjectShotstack = (): TypedParameterDecorator<ShotstackClient> => injector<ShotstackClient>(SHOTSTACK)
