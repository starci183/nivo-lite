import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RefreshZaloTokensOptions } from "./refresh-zalo-tokens.options"

type Host = ConfigurableModuleHost<RefreshZaloTokensOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RefreshZaloTokensOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the refresh-zalo-tokens module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the refresh-zalo-tokens module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the refresh-zalo-tokens module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
