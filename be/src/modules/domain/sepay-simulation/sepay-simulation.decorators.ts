import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { SepaySimulationOptions } from "./sepay-simulation.options"

/** Token of the simulation options, exported so a spec can provide it. */
export const SEPAY_SIMULATION_OPTIONS: unique symbol = Symbol("domain.sepay-simulation.options")

/** Injects the options of the simulation. Parameter type: SepaySimulationOptions. */
export const InjectSepaySimulationOptions = (): TypedParameterDecorator<SepaySimulationOptions> =>
    injector<SepaySimulationOptions>(SEPAY_SIMULATION_OPTIONS)
