import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentPublishingGraphqlOptions } from "./content-publishing-graphql.options"

/** The configurable-module base of the content-publishing-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ContentPublishingGraphqlOptions>().setClassMethodName("register").build()
