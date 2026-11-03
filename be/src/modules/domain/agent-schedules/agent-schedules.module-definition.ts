import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentSchedulesOptions } from "./agent-schedules.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentSchedulesOptions>()
