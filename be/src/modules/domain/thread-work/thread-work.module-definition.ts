import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ThreadWorkOptions } from "./thread-work.options"

/** The configurable-module base of the thread-work capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ThreadWorkOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
