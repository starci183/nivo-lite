import { defineCapabilityModule } from "@starci/nest-kit"
import type { ConversationsOptions } from "./conversations.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ConversationsOptions>()
