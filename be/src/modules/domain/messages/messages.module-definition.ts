import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { MessagesOptions } from "./messages.options"

/** The configurable-module base of the messages capability. */
const definition = new ConfigurableModuleBuilder<MessagesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    MessagesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: MessagesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
