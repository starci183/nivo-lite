import { defineConfigurableModule } from "@starci/nest-kit"
import type { ChatTypingSseOptions } from "./chat-typing-sse.options"

/** The configurable-module base of the chat-typing-sse module. */
export const { ConfigurableModuleClass } = defineConfigurableModule<ChatTypingSseOptions>()
