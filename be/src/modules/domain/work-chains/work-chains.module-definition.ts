import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WorkChainsOptions } from "./work-chains.options"

/** The configurable-module base of the work-chains capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<WorkChainsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
