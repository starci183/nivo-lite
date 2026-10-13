import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WorkPerformersOptions } from "./work-performers.options"

/** The configurable-module base of the work-performers capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<WorkPerformersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
