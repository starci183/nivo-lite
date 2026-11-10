import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentInstancesOptions } from "./agent-instances.options"

/** The configurable module base of the agent-instances capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentInstancesOptions>()
