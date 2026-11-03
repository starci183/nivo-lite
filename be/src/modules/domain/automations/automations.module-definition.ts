import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AutomationsOptions } from "./automations.options"

/** The configurable-module base of the automations capability. */
const definition = new ConfigurableModuleBuilder<AutomationsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AutomationsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AutomationsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
