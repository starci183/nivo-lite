import { ConfigurableModuleBuilder } from "@nestjs/common"
import { SEPAY_SIMULATION_OPTIONS } from "./sepay-simulation.decorators"
import type { SepaySimulationRegistration } from "./sepay-simulation.options"

/** The configurable-module base of the simulation. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SepaySimulationRegistration>({
    optionsInjectionToken: SEPAY_SIMULATION_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
