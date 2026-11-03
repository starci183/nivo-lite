import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentWorkOptions } from "./agent-work.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentWorkOptions>()
