import { defineConfigurableModule } from "@starci/nest-kit"
import type { ReembedKnowledgeQueueOptions } from "./reembed-knowledge-queue.options"

/** The configurable-module base of the reembed-knowledge-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ReembedKnowledgeQueueOptions>()
