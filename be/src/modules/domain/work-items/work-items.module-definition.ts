import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WorkItemsOptions } from "./work-items.options"

/** The configurable-module base of the work items capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<WorkItemsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
