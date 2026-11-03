import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentRunsOptions } from "./agent-runs.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentRunsOptions>()
