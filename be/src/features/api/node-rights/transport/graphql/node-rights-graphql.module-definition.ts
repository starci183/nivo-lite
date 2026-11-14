import { defineConfigurableModule } from "@starci/nest-kit"
import type { NodeRightsGraphqlOptions } from "./node-rights-graphql.options"

/** The configurable-module base of the node rights GraphQL module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<NodeRightsGraphqlOptions>()
