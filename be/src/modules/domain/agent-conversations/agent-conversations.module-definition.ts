import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentConversationsOptions } from "./agent-conversations.options"

/** The configurable-module base of the agent-conversations capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<AgentConversationsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentConversationsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentConversationsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
