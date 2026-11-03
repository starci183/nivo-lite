import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentPluginsOptions } from "./agent-plugins.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentPluginsOptions>()
