import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ChatReplyOptions } from "./chatreply.options"

/** The configurable module base of customer reply orchestration. */
const definition = new ConfigurableModuleBuilder<ChatReplyOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ChatReplyOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ChatReplyOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
