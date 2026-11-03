import { defineCapabilityModule } from "@starci/nest-kit"
import type { ChatTypingOptions } from "./chat-typing.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ChatTypingOptions>()
