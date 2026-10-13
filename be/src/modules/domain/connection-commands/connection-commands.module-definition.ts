import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConnectionCommandsOptions } from "./connection-commands.options"

/** The configurable-module base of the connection-commands capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ConnectionCommandsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
