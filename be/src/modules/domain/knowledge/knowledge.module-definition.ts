import { defineCapabilityModule } from "@starci/nest-kit"
import { KNOWLEDGE_OPTIONS } from "./knowledge.decorators"
import type { KnowledgeOptions } from "./knowledge.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<KnowledgeOptions>({
    optionsInjectionToken: KNOWLEDGE_OPTIONS,
})
