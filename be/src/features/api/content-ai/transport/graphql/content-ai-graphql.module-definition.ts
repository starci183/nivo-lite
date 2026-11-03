import { defineConfigurableModule } from "@starci/nest-kit"
import type { ContentAiGraphqlOptions } from "./content-ai-graphql.options"

/** The configurable-module base of the content-ai-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ContentAiGraphqlOptions>()
