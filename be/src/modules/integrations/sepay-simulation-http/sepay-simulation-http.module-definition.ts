import { ConfigurableModuleBuilder } from "@nestjs/common"
import { SEPAY_SIMULATION_HTTP_OPTIONS } from "./sepay-simulation-http.decorators"
import type { SepaySimulationHttpOptions } from "./sepay-simulation-http.options"

/** The configurable-module base of the simulated SePay HTTP delivery. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SepaySimulationHttpOptions>({
    optionsInjectionToken: SEPAY_SIMULATION_HTTP_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
