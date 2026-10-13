import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { KnowledgeSourcesOptions } from "./knowledge-sources.options"

/** The configurable-module base of the knowledge-sources capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<KnowledgeSourcesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
