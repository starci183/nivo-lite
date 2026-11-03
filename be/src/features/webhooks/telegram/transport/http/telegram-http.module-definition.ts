import { defineConfigurableModule } from "@starci/nest-kit"
import type { TelegramHttpOptions } from "./telegram-http.options"

/** The configurable-module base of the telegram-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<TelegramHttpOptions>()
