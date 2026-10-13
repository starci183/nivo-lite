import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BrainCommandsOptions } from "./brain-commands.options"

/** The configurable-module base of the brain-commands capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BrainCommandsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
