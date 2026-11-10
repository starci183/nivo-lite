import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentWorkflowsGraphqlOptions } from "./agent-workflows-graphql.options"

/** The configurable-module base of the workflows GraphQL module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentWorkflowsGraphqlOptions>()
