import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { KnowledgeGapsOptions } from "./knowledge-gaps.options"

/** The configurable-module base of the knowledge-gaps capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<KnowledgeGapsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
