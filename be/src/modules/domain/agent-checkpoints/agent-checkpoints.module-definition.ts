import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentCheckpointsOptions } from "./agent-checkpoints.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentCheckpointsOptions>()
