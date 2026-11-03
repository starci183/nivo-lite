import { defineCapabilityModule } from "@starci/nest-kit"
import type { AgentInboundOptions } from "./agent-inbound.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AgentInboundOptions>()
