import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { FlowEngineOptions } from "./flow-engine.options"

/** The configurable module base of the flow engine capability. */
const definition = new ConfigurableModuleBuilder<FlowEngineOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    FlowEngineOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: FlowEngineOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
