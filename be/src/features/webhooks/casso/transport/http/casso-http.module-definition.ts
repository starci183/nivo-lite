import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { CassoHttpOptions } from "./casso-http.options"

type Host = ConfigurableModuleHost<CassoHttpOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<CassoHttpOptions>().setClassMethodName("register").build()

/** The configurable-module base of the casso-http module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the casso-http module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the casso-http module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
