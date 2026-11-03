import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AutomationPipelinesOptions } from "./automation-pipelines.options"

/** The configurable-module base of the automation-pipelines capability. */
const definition = new ConfigurableModuleBuilder<AutomationPipelinesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AutomationPipelinesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AutomationPipelinesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
