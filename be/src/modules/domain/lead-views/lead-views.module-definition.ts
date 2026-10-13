import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeadViewsOptions } from "./lead-views.options"

/** The configurable-module base of the authorized lead views. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LeadViewsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
