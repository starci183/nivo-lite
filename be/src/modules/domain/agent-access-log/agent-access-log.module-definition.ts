import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentAccessLogOptions } from "./agent-access-log.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentAccessLogOptions>()
