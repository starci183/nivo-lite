import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentsOptions } from "./agents.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentsOptions>()
