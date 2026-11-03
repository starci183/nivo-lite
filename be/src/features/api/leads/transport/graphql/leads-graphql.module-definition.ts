import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { LeadsGraphqlOptions } from "./leads-graphql.options"

type Host = ConfigurableModuleHost<LeadsGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<LeadsGraphqlOptions>().setClassMethodName("register").build()

/** The configurable-module base of the leads-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the leads-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the leads-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
