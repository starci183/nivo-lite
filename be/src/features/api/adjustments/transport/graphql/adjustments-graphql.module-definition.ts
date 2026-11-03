import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { AdjustmentsGraphqlOptions } from "./adjustments-graphql.options"

type Host = ConfigurableModuleHost<AdjustmentsGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<AdjustmentsGraphqlOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the adjustments-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the adjustments-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the adjustments-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
