import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { TelegramHttpOptions } from "./telegram-http.options"

/** The configurable-module base of the telegram-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<TelegramHttpOptions>().setClassMethodName("register").build()
