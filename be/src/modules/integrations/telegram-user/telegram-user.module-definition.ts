import { ConfigurableModuleBuilder } from "@nestjs/common"
import { TELEGRAM_USER_OPTIONS } from "./telegram-user.decorators"
import type { TelegramUserOptions } from "./telegram-user.options"

/** The configurable-module base of the personal Telegram integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<TelegramUserOptions>({ optionsInjectionToken: TELEGRAM_USER_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
