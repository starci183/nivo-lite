import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { CompleteZaloAuthorizationOptions } from "./complete-zalo-authorization.options"

type Host = ConfigurableModuleHost<CompleteZaloAuthorizationOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<CompleteZaloAuthorizationOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the complete-zalo-authorization module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the complete-zalo-authorization module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the complete-zalo-authorization module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
