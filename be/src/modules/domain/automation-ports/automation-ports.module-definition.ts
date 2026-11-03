import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AutomationPortsOptions } from "./automation-ports.options"

/** The configurable-module base of the automation ports. */
const definition = new ConfigurableModuleBuilder<AutomationPortsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AutomationPortsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AutomationPortsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
