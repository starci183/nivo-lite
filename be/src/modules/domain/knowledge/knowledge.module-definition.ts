import { ConfigurableModuleBuilder } from "@nestjs/common"
import { KNOWLEDGE_OPTIONS } from "./knowledge.decorators"
import type { KnowledgeOptions } from "./knowledge.options"

/** The configurable-module base of the knowledge capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<KnowledgeOptions>({
    optionsInjectionToken: KNOWLEDGE_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
