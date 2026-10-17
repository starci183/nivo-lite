import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { KnowledgeGraphqlOptions } from "./knowledge-graphql.options"

/** The configurable-module base of the knowledge-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<KnowledgeGraphqlOptions>().setClassMethodName("register").build()
