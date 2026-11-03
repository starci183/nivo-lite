import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ConversationsOptions } from "./conversations.options"

/** The configurable-module base of the conversations capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<ConversationsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ConversationsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ConversationsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
