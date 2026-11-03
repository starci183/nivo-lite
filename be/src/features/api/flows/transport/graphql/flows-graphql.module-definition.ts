import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { FlowsGraphqlOptions } from "./flows-graphql.options"

type Host = ConfigurableModuleHost<FlowsGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<FlowsGraphqlOptions>().setClassMethodName("register").build()

/** The configurable-module base of the flows-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the flows-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the flows-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
