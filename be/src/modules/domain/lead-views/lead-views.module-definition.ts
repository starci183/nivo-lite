import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LeadViewsOptions } from "./lead-views.options"

/** The configurable-module base of the authorized lead views. */
const definition = new ConfigurableModuleBuilder<LeadViewsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    LeadViewsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: LeadViewsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
