import { defineConfigurableModule } from "@starci/nest-kit"
import type { ConnectionsGraphqlOptions } from "./connections-graphql.options"

/** The configurable-module base of the connections-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ConnectionsGraphqlOptions>()
