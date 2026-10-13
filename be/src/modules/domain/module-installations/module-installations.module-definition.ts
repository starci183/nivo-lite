import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ModuleInstallationsOptions } from "./module-installations.options"

/** The configurable-module base of the module-installations capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ModuleInstallationsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
