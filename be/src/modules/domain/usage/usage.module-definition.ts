import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { UsageOptions } from "./usage.options"

/** The configurable-module base of the usage capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<UsageOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
