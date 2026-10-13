import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AutomationCommandsOptions } from "./automation-commands.options"

/** The configurable-module base of the automation-commands capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AutomationCommandsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
