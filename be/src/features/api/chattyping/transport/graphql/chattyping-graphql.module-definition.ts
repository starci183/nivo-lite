import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ChattypingGraphqlOptions } from "./chattyping-graphql.options"

type Host = ConfigurableModuleHost<ChattypingGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ChattypingGraphqlOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the typing GraphQL transport. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass
