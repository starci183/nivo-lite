import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ChatFilesOptions } from "./chat-files.options"

/** The chat-files module base; the app root decides whether it is global. */
const definition = new ConfigurableModuleBuilder<ChatFilesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ChatFilesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ChatFilesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
