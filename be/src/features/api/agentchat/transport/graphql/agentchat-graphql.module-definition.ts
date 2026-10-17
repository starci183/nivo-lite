import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentChatGraphqlOptions } from "./agentchat-graphql.options"

/** The configurable-module base of the agentchat-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentChatGraphqlOptions>().setClassMethodName("register").build()
