import { defineConfigurableModule } from "@starci/nest-kit"
import type { PublicDocumentsGraphqlOptions } from "./public-documents-graphql.options"

/** The configurable-module base of the public-documents-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PublicDocumentsGraphqlOptions>()
