import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { SepayConnectionApiOptions } from "./sepay-connection.options"

type Host = ConfigurableModuleHost<SepayConnectionApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<SepayConnectionApiOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the sepay-connection module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the sepay-connection module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the sepay-connection module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
