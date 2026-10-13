import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ZaloClient } from "./zalo.client"
import type { ZaloOptions } from "./zalo.options"

/** Token of the Zalo client. */
export const ZALO: unique symbol = Symbol("integrations.zalo")

/** Token of the options of the Zalo integration, exported so a spec can provide it. */
export const ZALO_OPTIONS: unique symbol = Symbol("integrations.zalo.options")

/** Injects the options of the Zalo integration. Parameter type: ZaloOptions. */
export const InjectZaloOptions = (): TypedParameterDecorator<ZaloOptions> => injector<ZaloOptions>(ZALO_OPTIONS)

/** Injects the Zalo client. Parameter type: ZaloClient. */
export const InjectZalo = (): TypedParameterDecorator<ZaloClient> => injector<ZaloClient>(ZALO)
