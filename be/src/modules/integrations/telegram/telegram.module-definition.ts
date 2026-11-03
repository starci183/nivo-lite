import { defineCapabilityModule } from "@starci/nest-kit"
import { TELEGRAM_OPTIONS } from "./telegram.decorators"
import type { TelegramOptions } from "./telegram.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<TelegramOptions>({
    optionsInjectionToken: TELEGRAM_OPTIONS,
})
