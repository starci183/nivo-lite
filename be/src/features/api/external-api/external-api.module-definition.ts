import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ExternalApiOptions } from "./external-api.options"

type Host = ConfigurableModuleHost<ExternalApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ExternalApiOptions>().setClassMethodName("register").build()

/** The configurable-module base of the external-api module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the external-api module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the external-api module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
