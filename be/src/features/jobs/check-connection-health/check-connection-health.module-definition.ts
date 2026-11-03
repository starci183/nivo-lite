import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { CheckConnectionHealthOptions } from "./check-connection-health.options"

type Host = ConfigurableModuleHost<CheckConnectionHealthOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<CheckConnectionHealthOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the check-connection-health module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the check-connection-health module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the check-connection-health module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
