import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { FlowEngineOptions } from "./flow-engine.options"

/** The configurable module base of the flow engine capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<FlowEngineOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
