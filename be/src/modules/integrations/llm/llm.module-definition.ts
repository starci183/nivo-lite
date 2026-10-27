import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LlmWiring } from "./llm.options"

/** The configurable-module base of the language-model integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LlmWiring>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
