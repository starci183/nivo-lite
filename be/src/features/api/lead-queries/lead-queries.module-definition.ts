import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { LeadQueriesApiOptions } from "./lead-queries.options"

type Host = ConfigurableModuleHost<LeadQueriesApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<LeadQueriesApiOptions>().setClassMethodName("register").build()

/** The configurable-module base of the lead-queries module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the lead-queries module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the lead-queries module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
