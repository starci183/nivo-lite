import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatTypingSseOptions } from "./chat-typing-sse.options"

/** The configurable-module base of the chat-typing-sse module. */
export const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<ChatTypingSseOptions>()
    .setClassMethodName("register")
    .build()
