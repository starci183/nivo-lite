import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LeadActionsOptions } from "./lead-actions.options"

/** The configurable-module base of the lead-actions capability. */
const definition = new ConfigurableModuleBuilder<LeadActionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    LeadActionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: LeadActionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
