import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ShellOptions } from "./shell.options"

/** The configurable-module base of the shell capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ShellOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
