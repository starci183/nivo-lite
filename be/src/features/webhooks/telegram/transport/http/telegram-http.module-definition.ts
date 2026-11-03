import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { TelegramHttpOptions } from "./telegram-http.options"

type Host = ConfigurableModuleHost<TelegramHttpOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<TelegramHttpOptions>().setClassMethodName("register").build()

/** The configurable-module base of the telegram-http module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the telegram-http module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the telegram-http module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
