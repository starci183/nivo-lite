import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentGraphsOptions } from "./agent-graphs.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentGraphsOptions>()
