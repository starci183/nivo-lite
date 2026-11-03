import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ExecutionsOptions } from "./executions.options"

/** The configurable-module base of the executions capability. */
const definition = new ConfigurableModuleBuilder<ExecutionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ExecutionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ExecutionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
