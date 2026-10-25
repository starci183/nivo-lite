import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatTypingOptions } from "./chat-typing.options"

/** The configurable-module base of the chat typing capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ChatTypingOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
