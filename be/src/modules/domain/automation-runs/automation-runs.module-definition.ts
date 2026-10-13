import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AutomationRunsOptions } from "./automation-runs.options"

/** The configurable-module base of the automation-runs capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AutomationRunsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
