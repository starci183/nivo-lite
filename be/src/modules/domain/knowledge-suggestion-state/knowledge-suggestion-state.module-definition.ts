import { defineCapabilityModule } from "@starci/nest-kit"
import type { KnowledgeSuggestionStateOptions } from "./knowledge-suggestion-state.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<KnowledgeSuggestionStateOptions>()
