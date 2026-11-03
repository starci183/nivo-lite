import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { FlowsOptions } from "./flows.options"

/** The configurable-module base of the flows capability. */
const definition = new ConfigurableModuleBuilder<FlowsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    FlowsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: FlowsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
