import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { WorkThreadsGraphqlOptions } from "./work-threads-graphql.options"

type Host = ConfigurableModuleHost<WorkThreadsGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<WorkThreadsGraphqlOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the work-threads-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the work-threads-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the work-threads-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
