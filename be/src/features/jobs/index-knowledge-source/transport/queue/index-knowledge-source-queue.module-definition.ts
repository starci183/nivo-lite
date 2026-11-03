import { defineConfigurableModule } from "@starci/nest-kit"
import type { IndexKnowledgeSourceQueueOptions } from "./index-knowledge-source-queue.options"

/** The configurable-module base of the index-knowledge-source-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<IndexKnowledgeSourceQueueOptions>()
