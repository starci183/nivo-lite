import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentToolsOptions } from "./agent-tools.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentToolsOptions>()
