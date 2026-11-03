import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { LeadQueriesGraphqlOptions } from "./lead-queries-graphql.options"

type Host = ConfigurableModuleHost<LeadQueriesGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<LeadQueriesGraphqlOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the lead-queries-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the lead-queries-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the lead-queries-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
