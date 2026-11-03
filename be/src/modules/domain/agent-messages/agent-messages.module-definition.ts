import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentMessagesOptions } from "./agent-messages.options"

/** The configurable-module base of the agent-messages capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<AgentMessagesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AgentMessagesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AgentMessagesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
