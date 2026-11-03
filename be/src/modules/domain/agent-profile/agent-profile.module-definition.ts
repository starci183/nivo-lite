import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentProfileOptions } from "./agent-profile.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentProfileOptions>()
