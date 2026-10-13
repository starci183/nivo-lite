import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeadGenWorkbenchOptions } from "./leadgen-workbench.options"

/** The configurable-module base of the Lead Gen projection. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LeadGenWorkbenchOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
