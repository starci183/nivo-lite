import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PublicDocumentsGraphqlOptions } from "./public-documents-graphql.options"

/** The configurable-module base of the public-documents-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PublicDocumentsGraphqlOptions>().setClassMethodName("register").build()
