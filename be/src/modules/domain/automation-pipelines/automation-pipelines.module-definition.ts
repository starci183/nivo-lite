import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AutomationPipelinesOptions } from "./automation-pipelines.options"

/** The configurable-module base of the automation-pipelines capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AutomationPipelinesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
