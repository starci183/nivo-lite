import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ThreadMessagesOptions } from "./thread-messages.options"

/** The configurable-module base of the work-threads capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<ThreadMessagesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ThreadMessagesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ThreadMessagesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
