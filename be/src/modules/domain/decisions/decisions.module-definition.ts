import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { DecisionsOptions } from "./decisions.options"

/** The configurable-module base of the decisions capability. */
const definition = new ConfigurableModuleBuilder<DecisionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    DecisionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: DecisionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
