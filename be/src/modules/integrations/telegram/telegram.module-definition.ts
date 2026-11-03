import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { TELEGRAM_OPTIONS } from "./telegram.decorators"
import type { TelegramOptions } from "./telegram.options"

/** The configurable-module base of the Telegram integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<TelegramOptions>({ optionsInjectionToken: TELEGRAM_OPTIONS })
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    TelegramOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: TelegramOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
