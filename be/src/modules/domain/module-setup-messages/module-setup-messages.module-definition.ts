import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ModuleSetupMessagesOptions } from "./module-setup-messages.options"

/** The configurable-module base of the module-setup-messages capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ModuleSetupMessagesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
