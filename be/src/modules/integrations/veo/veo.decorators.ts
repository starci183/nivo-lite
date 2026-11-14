import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { VeoClient } from "./veo.client"
import type { VeoOptions } from "./veo.options"

/** Token of the Veo client. */
export const VEO: unique symbol = Symbol("integrations.veo")

/** Token of the options of the Veo integration, exported so a spec can provide it. */
export const VEO_OPTIONS: unique symbol = Symbol("integrations.veo.options")

/** Injects the options of the Veo integration. Parameter type: VeoOptions. */
export const InjectVeoOptions = (): TypedParameterDecorator<VeoOptions> =>
    injector<VeoOptions>(VEO_OPTIONS)

/** Injects the Veo client. Parameter type: VeoClient. */
export const InjectVeo = (): TypedParameterDecorator<VeoClient> => injector<VeoClient>(VEO)
