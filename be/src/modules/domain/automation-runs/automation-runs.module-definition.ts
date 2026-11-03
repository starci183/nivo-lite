import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AutomationRunsOptions } from "./automation-runs.options"

/** The configurable-module base of the automation-runs capability. */
const definition = new ConfigurableModuleBuilder<AutomationRunsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AutomationRunsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AutomationRunsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
