import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { OwnersOptions } from "./owners.options"

/** Token of the options of the owners capability, exported so a spec can provide it. */
export const OWNERS_OPTIONS: unique symbol = Symbol("domain.owners.options")

/** Injects the options of the owners capability. Parameter type: OwnersOptions. */
export const InjectOwnersOptions = (): TypedParameterDecorator<OwnersOptions> => injector<OwnersOptions>(OWNERS_OPTIONS)
