import { defineConfigurableModule } from "@starci/nest-kit"
import type { ChatActivitySseOptions } from "./chat-activity-sse.options"

/** The configurable-module base of the chat-activity-sse module. */
export const { ConfigurableModuleClass } = defineConfigurableModule<ChatActivitySseOptions>()
