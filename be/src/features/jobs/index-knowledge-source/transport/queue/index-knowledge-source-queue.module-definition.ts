import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { IndexKnowledgeSourceQueueOptions } from "./index-knowledge-source-queue.options"

/** The configurable-module base of the index-knowledge-source-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<IndexKnowledgeSourceQueueOptions>().setClassMethodName("register").build()
