import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { TelegramConnectionPageApiOptions } from "./telegram-connection-page.options"

type Host = ConfigurableModuleHost<TelegramConnectionPageApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<TelegramConnectionPageApiOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the telegram-connection-page module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the telegram-connection-page module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the telegram-connection-page module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
