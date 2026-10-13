import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ModuleContextVersionsOptions } from "./module-context-versions.options"

/** The configurable-module base of the module-context-versions capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ModuleContextVersionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
