import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentsGraphqlOptions } from "./agents-graphql.options"

/** The configurable-module base of the agents-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentsGraphqlOptions>()
