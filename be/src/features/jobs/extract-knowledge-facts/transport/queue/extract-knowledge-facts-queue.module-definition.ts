import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ExtractKnowledgeFactsQueueOptions } from "./extract-knowledge-facts-queue.options"

/** The configurable-module base of the extract-knowledge-facts-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ExtractKnowledgeFactsQueueOptions>().setClassMethodName("register").build()
