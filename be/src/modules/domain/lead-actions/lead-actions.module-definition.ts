import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeadActionsOptions } from "./lead-actions.options"

/** The configurable-module base of the lead-actions capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LeadActionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
