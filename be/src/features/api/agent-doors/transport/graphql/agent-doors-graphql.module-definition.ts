import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentDoorsGraphqlOptions } from "./agent-doors-graphql.options"

/** The configurable-module base of the agent-doors-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentDoorsGraphqlOptions>()
