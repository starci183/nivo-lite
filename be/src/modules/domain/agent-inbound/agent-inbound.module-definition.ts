import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentInboundOptions } from "./agent-inbound.options"

/** The configurable-module base of the agent-inbound capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AgentInboundOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
