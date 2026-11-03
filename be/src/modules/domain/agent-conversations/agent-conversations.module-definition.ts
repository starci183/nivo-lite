import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentConversationsOptions } from "./agent-conversations.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentConversationsOptions>()
