import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ChatActivityOptions } from "./chat-activity.options"

/** The configurable-module base of the chat activity capability. */
const definition = new ConfigurableModuleBuilder<ChatActivityOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ChatActivityOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ChatActivityOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
