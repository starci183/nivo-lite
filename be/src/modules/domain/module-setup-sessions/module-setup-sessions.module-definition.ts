import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ModuleSetupSessionsOptions } from "./module-setup-sessions.options"

/** The configurable-module base of the module-setup-sessions capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ModuleSetupSessionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
