import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { CreatomateClient } from "./creatomate.client"
import type { CreatomateOptions } from "./creatomate.options"

/** Token of the Creatomate client. */
export const CREATOMATE: unique symbol = Symbol("integrations.creatomate")

/** Token of the options of the Creatomate integration, exported so a spec can provide it. */
export const CREATOMATE_OPTIONS: unique symbol = Symbol("integrations.creatomate.options")

/** Injects the options of the Creatomate integration. Parameter type: CreatomateOptions. */
export const InjectCreatomateOptions = (): TypedParameterDecorator<CreatomateOptions> =>
    injector<CreatomateOptions>(CREATOMATE_OPTIONS)

/** Injects the Creatomate client. Parameter type: CreatomateClient. */
export const InjectCreatomate = (): TypedParameterDecorator<CreatomateClient> => injector<CreatomateClient>(CREATOMATE)
