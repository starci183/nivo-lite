import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentRunsGraphqlOptions } from "./agent-runs-graphql.options"

/** The configurable-module base of the agent-runs-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentRunsGraphqlOptions>()
