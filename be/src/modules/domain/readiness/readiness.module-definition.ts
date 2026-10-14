import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ReadinessOptions } from "./readiness.options"

/** The configurable-module base of readiness; the app root decides whether it is global. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ReadinessOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
