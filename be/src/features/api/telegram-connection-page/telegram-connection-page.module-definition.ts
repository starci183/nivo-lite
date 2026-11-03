import { defineConfigurableModule } from "@starci/nest-kit"
import type { TelegramConnectionPageApiOptions } from "./telegram-connection-page.options"

/** The configurable-module base of the telegram-connection-page module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<TelegramConnectionPageApiOptions>()
