import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { PublicApiQueueOptions } from "./public-api.options"

/** The configurable-module base of the public-api module. */
const definition = new ConfigurableModuleBuilder<PublicApiQueueOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<PublicApiQueueOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: PublicApiQueueOptions = definition.OPTIONS_TYPE
