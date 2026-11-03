import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LeadFlowsOptions } from "./lead-flows.options"

/** The configurable-module base of the lead-flows capability. */
const definition = new ConfigurableModuleBuilder<LeadFlowsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    LeadFlowsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: LeadFlowsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
