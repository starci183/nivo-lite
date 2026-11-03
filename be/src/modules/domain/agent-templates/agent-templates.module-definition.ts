import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentTemplatesOptions } from "./agent-templates.options"

/** The configurable module base of the agent-templates capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentTemplatesOptions>()
