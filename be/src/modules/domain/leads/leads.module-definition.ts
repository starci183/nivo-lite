import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeadsOptions } from "./leads.options"

/** The configurable-module base of the leads capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LeadsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
