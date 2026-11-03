import { defineConfigurableModule } from "@starci/nest-kit"
import type { KnowledgeGraphqlOptions } from "./knowledge-graphql.options"

/** The configurable-module base of the knowledge-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<KnowledgeGraphqlOptions>()
