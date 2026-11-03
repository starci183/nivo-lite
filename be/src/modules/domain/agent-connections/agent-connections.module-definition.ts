import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentConnectionsOptions } from "./agent-connections.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentConnectionsOptions>()
