import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ChatMarkersOptions } from "./chat-markers.options"

/** Configurable-module base of the chat state capability. */
const definition = new ConfigurableModuleBuilder<ChatMarkersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ChatMarkersOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ChatMarkersOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
