import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { MetaConnectionsHttpOptions } from "./meta-connections-http.options"

type Host = ConfigurableModuleHost<MetaConnectionsHttpOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<MetaConnectionsHttpOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the meta-connections-http module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the meta-connections-http module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the meta-connections-http module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
