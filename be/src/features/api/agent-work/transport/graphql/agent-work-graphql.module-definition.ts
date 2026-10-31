import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentWorkGraphqlOptions } from "./agent-work-graphql.options"

/** The configurable-module base of the agent-work-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentWorkGraphqlOptions>().setClassMethodName("register").build()
