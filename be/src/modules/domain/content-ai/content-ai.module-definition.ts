import { ConfigurableModuleBuilder } from "@nestjs/common"
import { CONTENT_AI_OPTIONS } from "./content-agent.decorators"
import type { ContentAiOptions } from "./content-ai.options"

/** Configurable registration base with global scope selected by the root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ContentAiOptions>({
    optionsInjectionToken: CONTENT_AI_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
