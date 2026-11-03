import { defineConfigurableModule } from "@starci/nest-kit"
import type { KnowledgeQueueOptions } from "./knowledge.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<KnowledgeQueueOptions>()
