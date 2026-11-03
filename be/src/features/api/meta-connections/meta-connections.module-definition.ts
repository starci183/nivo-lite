import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { MetaConnectionsApiOptions } from "./meta-connections.options"

type Host = ConfigurableModuleHost<MetaConnectionsApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<MetaConnectionsApiOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the meta-connections module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the meta-connections module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the meta-connections module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
