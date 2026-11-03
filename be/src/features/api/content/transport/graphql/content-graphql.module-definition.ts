import { defineConfigurableModule } from "@starci/nest-kit"
import type { ContentGraphqlOptions } from "./content-graphql.options"

/** The configurable-module base of the content-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ContentGraphqlOptions>()
