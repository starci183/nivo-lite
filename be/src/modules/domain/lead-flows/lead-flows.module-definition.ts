import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeadFlowsOptions } from "./lead-flows.options"

/** The configurable-module base of the lead-flows capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LeadFlowsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
