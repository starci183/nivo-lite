import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatActivitySseOptions } from "./chat-activity-sse.options"

/** The configurable-module base of the chat-activity-sse module. */
export const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<ChatActivitySseOptions>()
    .setClassMethodName("register")
    .build()
