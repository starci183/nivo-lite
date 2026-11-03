import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AutomationCommandsOptions } from "./automation-commands.options"

/** The configurable-module base of the automation-commands capability. */
const definition = new ConfigurableModuleBuilder<AutomationCommandsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AutomationCommandsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AutomationCommandsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
