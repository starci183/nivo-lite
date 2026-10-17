import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { IndexKnowledgeSourceOptions } from "./index-knowledge-source.options"

/** The configurable-module base of the index-knowledge-source module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<IndexKnowledgeSourceOptions>().setClassMethodName("register").build()
