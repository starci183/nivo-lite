import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DecisionsOptions } from "./decisions.options"

/** The configurable-module base of the decisions capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<DecisionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
