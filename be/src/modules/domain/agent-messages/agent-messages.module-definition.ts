import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentMessagesOptions } from "./agent-messages.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentMessagesOptions>()
