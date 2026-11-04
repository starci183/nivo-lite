import { defineCapabilityModule } from "@starci/nest-kit"
import { TELEGRAM_USER_OPTIONS } from "./telegram-user.decorators"
import type { TelegramUserOptions } from "./telegram-user.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineCapabilityModule<TelegramUserOptions>({
        optionsInjectionToken: TELEGRAM_USER_OPTIONS,
    })
