import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { FlowsOptions } from "./flows.options"

/** The configurable-module base of the flows capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<FlowsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
