import { ConfigurableModuleBuilder } from "@nestjs/common"
import { TELEGRAM_OPTIONS } from "./telegram.decorators"
import type { TelegramOptions } from "./telegram.options"

/** The configurable-module base of the Telegram integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<TelegramOptions>({ optionsInjectionToken: TELEGRAM_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
