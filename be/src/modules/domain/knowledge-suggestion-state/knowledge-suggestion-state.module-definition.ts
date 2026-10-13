import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { KnowledgeSuggestionStateOptions } from "./knowledge-suggestion-state.options"

/** The configurable-module base of the knowledge-suggestion-state capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<KnowledgeSuggestionStateOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
