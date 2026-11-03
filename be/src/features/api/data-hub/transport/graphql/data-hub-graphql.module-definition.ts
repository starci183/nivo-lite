import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { DataHubGraphqlOptions } from "./data-hub-graphql.options"

type Host = ConfigurableModuleHost<DataHubGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<DataHubGraphqlOptions>().setClassMethodName("register").build()

/** The configurable-module base of the data-hub-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the data-hub-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the data-hub-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
