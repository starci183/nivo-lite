import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { SepaySimulationHttpOptions } from "./sepay-simulation-http.options"

/** Token of the callback that delivers a simulated SePay webhook. */
export const SEPAY_SIMULATION_POST: unique symbol = Symbol("integrations.sepay-simulation-http.post")

/** Token of the simulated delivery options. */
export const SEPAY_SIMULATION_HTTP_OPTIONS: unique symbol = Symbol("integrations.sepay-simulation-http.options")

/** Injects the simulated delivery options. Parameter type: SepaySimulationHttpOptions. */
export const InjectSepaySimulationHttpOptions = (): TypedParameterDecorator<SepaySimulationHttpOptions> =>
    injector<SepaySimulationHttpOptions>(SEPAY_SIMULATION_HTTP_OPTIONS)
