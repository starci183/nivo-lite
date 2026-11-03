import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ConnectionsGraphqlOptions } from "./connections-graphql.options"

type Host = ConfigurableModuleHost<ConnectionsGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ConnectionsGraphqlOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the connections-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the connections-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the connections-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
