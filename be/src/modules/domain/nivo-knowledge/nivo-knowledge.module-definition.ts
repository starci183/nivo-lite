import { ConfigurableModuleBuilder } from "@nestjs/common"
import { NIVO_KNOWLEDGE_OPTIONS } from "./nivo-knowledge.decorators"
import type { NivoKnowledgeOptions } from "./nivo-knowledge.options"

/** The configurable-module base of the nivo-knowledge capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<NivoKnowledgeOptions>({
    optionsInjectionToken: NIVO_KNOWLEDGE_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
