import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ChatTypingOptions } from "./chat-typing.options"

/** The configurable-module base of the chat typing capability. */
const definition = new ConfigurableModuleBuilder<ChatTypingOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ChatTypingOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ChatTypingOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
