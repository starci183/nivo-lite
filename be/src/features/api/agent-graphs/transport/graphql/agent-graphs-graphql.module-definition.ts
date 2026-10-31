import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentGraphsGraphqlOptions } from "./agent-graphs-graphql.options"

/** The configurable-module base of the agent graph GraphQL module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentGraphsGraphqlOptions>().setClassMethodName("register").build()
