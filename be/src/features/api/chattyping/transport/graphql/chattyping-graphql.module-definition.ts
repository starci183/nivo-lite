import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChattypingGraphqlOptions } from "./chattyping-graphql.options"

/** The configurable-module base of the typing GraphQL transport. */
export const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<ChattypingGraphqlOptions>()
    .setClassMethodName("register")
    .build()
