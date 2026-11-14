import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { MisaAmisClient } from "./misa-amis.client"
import type { MisaAmisOptions } from "./misa-amis.options"

/** Token of the MisaAmis client. */
export const MISA_AMIS: unique symbol = Symbol("integrations.misa-amis")

/** Token of the options of the MisaAmis integration, exported so a spec can provide it. */
export const MISA_AMIS_OPTIONS: unique symbol = Symbol("integrations.misa-amis.options")

/** Injects the options of the MisaAmis integration. Parameter type: MisaAmisOptions. */
export const InjectMisaAmisOptions = (): TypedParameterDecorator<MisaAmisOptions> =>
    injector<MisaAmisOptions>(MISA_AMIS_OPTIONS)

/** Injects the MisaAmis client. Parameter type: MisaAmisClient. */
export const InjectMisaAmis = (): TypedParameterDecorator<MisaAmisClient> => injector<MisaAmisClient>(MISA_AMIS)
