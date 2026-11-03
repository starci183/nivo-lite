import { defineConfigurableModule } from "@starci/nest-kit"
import type { ContentMediaGraphqlOptions } from "./content-media-graphql.options"

/** The configurable-module base of the content-media-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ContentMediaGraphqlOptions>()
