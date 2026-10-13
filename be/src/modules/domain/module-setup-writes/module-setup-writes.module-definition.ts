import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ModuleSetupWritesOptions } from "./module-setup-writes.options"

/** The configurable-module base of the module-setup-writes capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ModuleSetupWritesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
