import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { KnowledgeChunksOptions } from "./knowledge-chunks.options"

/** The configurable-module base of the knowledge-chunks capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<KnowledgeChunksOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
