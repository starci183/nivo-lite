import { ConfigurableModuleBuilder } from "@nestjs/common"
import { AI_OPTIONS } from "./ai.decorators"
import type { AiOptions } from "./ai.options"

/** The configurable-module base of the LangChain integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AiOptions>({
    optionsInjectionToken: AI_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
