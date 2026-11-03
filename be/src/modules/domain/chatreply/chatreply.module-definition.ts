import { defineCapabilityModule } from "@starci/nest-kit"
import type { ChatReplyOptions } from "./chatreply.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ChatReplyOptions>()
