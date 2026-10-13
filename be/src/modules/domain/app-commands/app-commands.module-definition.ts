import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AppCommandsOptions } from "./app-commands.options"

/** The configurable-module base of the app-commands capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AppCommandsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
