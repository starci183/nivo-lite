import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ResponsibilitiesOptions } from "./responsibilities.options"

/** The configurable-module base of the responsibilities capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ResponsibilitiesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
