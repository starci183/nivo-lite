import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OverviewOptions } from "./overview.options"

/** The configurable-module base of the overview capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OverviewOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
