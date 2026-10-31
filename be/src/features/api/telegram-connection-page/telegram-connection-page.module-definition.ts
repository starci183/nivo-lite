import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { TelegramConnectionPageApiOptions } from "./telegram-connection-page.options"

/** The configurable-module base of the telegram-connection-page module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<TelegramConnectionPageApiOptions>().setClassMethodName("register").build()
