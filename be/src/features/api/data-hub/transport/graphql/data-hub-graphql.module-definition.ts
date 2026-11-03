import { defineConfigurableModule } from "@starci/nest-kit"
import type { DataHubGraphqlOptions } from "./data-hub-graphql.options"

/** The configurable-module base of the data-hub-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DataHubGraphqlOptions>()
