import { defineConfigurableModule } from "@starci/nest-kit"
import type { FlowsGraphqlOptions } from "./flows-graphql.options"

/** The configurable-module base of the flows-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<FlowsGraphqlOptions>()
