import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentDoorsOptions } from "./agent-doors.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentDoorsOptions>()
