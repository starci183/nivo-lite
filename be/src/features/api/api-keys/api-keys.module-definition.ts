import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ApiKeysApiOptions } from "./api-keys.options"

type Host = ConfigurableModuleHost<ApiKeysApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ApiKeysApiOptions>().setClassMethodName("register").build()

/** The configurable-module base of the api-keys module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the api-keys module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the api-keys module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
