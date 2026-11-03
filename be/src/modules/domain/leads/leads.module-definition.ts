import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LeadsOptions } from "./leads.options"

/** The configurable-module base of the leads capability. */
const definition = new ConfigurableModuleBuilder<LeadsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    LeadsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: LeadsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
