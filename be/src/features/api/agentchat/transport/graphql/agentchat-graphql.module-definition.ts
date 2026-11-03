import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentChatGraphqlOptions } from "./agentchat-graphql.options"

/** The configurable-module base of the agentchat-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentChatGraphqlOptions>()
