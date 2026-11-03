import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentChatOptions } from "./agent-chat.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentChatOptions>()
