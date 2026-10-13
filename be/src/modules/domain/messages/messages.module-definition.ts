import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { MessagesOptions } from "./messages.options"

/** The configurable-module base of the messages capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<MessagesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
