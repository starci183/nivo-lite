import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { TinoClient } from "./tino.client"
import type { TinoOptions } from "./tino.options"

/** Token of the Tino client. */
export const TINO: unique symbol = Symbol("integrations.tino")

/** Token of the options of the Tino integration, exported so a spec can provide it. */
export const TINO_OPTIONS: unique symbol = Symbol("integrations.tino.options")

/** Injects the options of the Tino integration. Parameter type: TinoOptions. */
export const InjectTinoOptions = (): TypedParameterDecorator<TinoOptions> => injector<TinoOptions>(TINO_OPTIONS)

/** Injects the Tino client. Parameter type: TinoClient. */
export const InjectTino = (): TypedParameterDecorator<TinoClient> => injector<TinoClient>(TINO)
