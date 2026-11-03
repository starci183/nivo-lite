import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { PayosHttpOptions } from "./payos-http.options"

type Host = ConfigurableModuleHost<PayosHttpOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<PayosHttpOptions>().setClassMethodName("register").build()

/** The configurable-module base of the payos-http module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the payos-http module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the payos-http module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
