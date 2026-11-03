import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { KnowledgeSuggestionStateOptions } from "./knowledge-suggestion-state.options"

/** The configurable-module base of the knowledge-suggestion-state capability. */
const definition = new ConfigurableModuleBuilder<KnowledgeSuggestionStateOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    KnowledgeSuggestionStateOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: KnowledgeSuggestionStateOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
