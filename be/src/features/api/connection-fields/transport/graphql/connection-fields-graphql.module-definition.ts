import { defineConfigurableModule } from "@starci/nest-kit"
import type { ConnectionFieldsGraphqlOptions } from "./connection-fields-graphql.options"

/** The configurable-module base of the connection form GraphQL module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ConnectionFieldsGraphqlOptions>()
