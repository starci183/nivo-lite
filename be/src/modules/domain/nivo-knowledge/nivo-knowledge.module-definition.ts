import { defineCapabilityModule } from "@starci/nest-kit"
import { NIVO_KNOWLEDGE_OPTIONS } from "./nivo-knowledge.decorators"
import type { NivoKnowledgeOptions } from "./nivo-knowledge.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<NivoKnowledgeOptions>({
    optionsInjectionToken: NIVO_KNOWLEDGE_OPTIONS,
})
