import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatActivityOptions } from "./chat-activity.options"

/** The configurable-module base of the chat activity capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ChatActivityOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
