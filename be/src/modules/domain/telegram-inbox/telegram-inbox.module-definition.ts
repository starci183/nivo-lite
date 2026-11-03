import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { TelegramInboxOptions } from "./telegram-inbox.options"

/** The configurable-module base of the telegram-inbox capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<TelegramInboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    TelegramInboxOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: TelegramInboxOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
