import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentInboundOptions } from "./agent-inbound.options"

/** The configurable-module base of the agent-inbound capability. */
const definition = new ConfigurableModuleBuilder<AgentInboundOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentInboundOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentInboundOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
