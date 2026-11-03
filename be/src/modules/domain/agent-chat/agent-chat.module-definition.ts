import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentChatOptions } from "./agent-chat.options"

/** The configurable module base of the agent chat capability. */
const definition = new ConfigurableModuleBuilder<AgentChatOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentChatOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentChatOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
