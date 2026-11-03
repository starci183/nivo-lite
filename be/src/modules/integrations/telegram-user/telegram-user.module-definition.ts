import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { TELEGRAM_USER_OPTIONS } from "./telegram-user.decorators"
import type { TelegramUserOptions } from "./telegram-user.options"

/** The configurable-module base of the personal Telegram integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<TelegramUserOptions>({ optionsInjectionToken: TELEGRAM_USER_OPTIONS })
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    TelegramUserOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: TelegramUserOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
