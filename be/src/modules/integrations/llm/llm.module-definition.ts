import { ConfigurableModuleBuilder } from "@nestjs/common"
import { LLM_OPTIONS } from "./llm.decorators"
import type { LlmOptions } from "./llm.options"

/** The configurable-module base of the language-model integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LlmOptions>({
    optionsInjectionToken: LLM_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
